import { eq } from "drizzle-orm";
import * as schema from "@/db/schema";
import { getAuthInstance } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { phoneFromEmail, sendWhatsApp } from "@/lib/notify";
import { OTP_MAX_ATTEMPTS, OTP_RE, PIN_RE, hashOtp, hashPin } from "@/lib/pin";
import { signaturesEqual } from "@/lib/webhook";

/**
 * POST /api/pin/reset { otp, pin } — set a new PIN with a reset code.
 * Exhausting attempts invalidates the code (request a fresh one).
 * Success clears PIN lockout and notifies WhatsApp.
 */
export async function POST(request: Request) {
  const auth = await getAuthInstance();
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) {
    return Response.json({ ok: false, error: "Unauthorized." }, { status: 401 });
  }

  let body: { otp?: unknown; pin?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json(
      { ok: false, error: "Request body must be JSON { otp, pin }." },
      { status: 400 },
    );
  }
  const otp = typeof body.otp === "string" ? body.otp.trim() : "";
  const pin = typeof body.pin === "string" ? body.pin.trim() : "";
  if (!OTP_RE.test(otp) || !PIN_RE.test(pin)) {
    return Response.json({ ok: false, error: "Bad code or PIN." }, { status: 400 });
  }

  const { db } = getDb();
  const person = await db.query.user.findFirst({
    where: (u, { eq }) => eq(u.id, session.user.id),
  });
  if (!person?.resetOtpHash || !person.resetOtpExpiresAt) {
    return Response.json(
      { ok: false, error: "No active reset code. Request one first." },
      { status: 400 },
    );
  }
  if (person.resetOtpExpiresAt.getTime() < Date.now()) {
    await db
      .update(schema.user)
      .set({ resetOtpHash: null, resetOtpExpiresAt: null, updatedAt: new Date() })
      .where(eq(schema.user.id, person.id));
    return Response.json(
      { ok: false, error: "Code expired. Request a fresh one." },
      { status: 400 },
    );
  }

  const good = signaturesEqual(
    await hashOtp(otp, person.id),
    person.resetOtpHash,
  );
  if (!good) {
    const attempts = (person.resetOtpAttempts ?? 0) + 1;
    const exhausted = attempts >= OTP_MAX_ATTEMPTS;
    await db
      .update(schema.user)
      .set({
        resetOtpAttempts: attempts,
        // Burn the code when attempts run out — fresh flow required.
        resetOtpHash: exhausted ? null : person.resetOtpHash,
        resetOtpExpiresAt: exhausted ? null : person.resetOtpExpiresAt,
        updatedAt: new Date(),
      })
      .where(eq(schema.user.id, person.id));
    return Response.json(
      {
        ok: false,
        error: exhausted
          ? "Too many wrong codes. Request a fresh one."
          : "Wrong code. Try again.",
      },
      { status: 403 },
    );
  }

  await db
    .update(schema.user)
    .set({
      pinHash: await hashPin(pin, person.id),
      pinAttempts: 0,
      pinLockedUntil: null,
      resetOtpHash: null,
      resetOtpExpiresAt: null,
      resetOtpAttempts: 0,
      updatedAt: new Date(),
    })
    .where(eq(schema.user.id, person.id));

  const phone = phoneFromEmail(session.user.email);
  if (phone) {
    void sendWhatsApp(
      phone,
      `*Security notice: your Amana transaction PIN was just reset.*\n\n_If this wasn't you, reset it on your dashboard now._`,
    );
  }
  return Response.json({ ok: true });
}
