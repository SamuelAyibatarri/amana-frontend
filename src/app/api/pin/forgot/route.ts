import { eq } from "drizzle-orm";
import * as schema from "@/db/schema";
import { getAuthInstance } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { phoneFromEmail, sendWhatsApp } from "@/lib/notify";
import { OTP_TTL_MS, hashOtp, makeOtp } from "@/lib/pin";

/**
 * POST /api/pin/forgot — send a 6-digit reset code to the user's WhatsApp.
 * Session-authenticated (proves the browser); the code proves the phone.
 * Only the hash is stored, 10-minute expiry, 5-attempt cap, 60s resend
 * cooldown (derived from expiry — no extra column).
 */
export async function POST(request: Request) {
  const auth = await getAuthInstance();
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) {
    return Response.json({ ok: false, error: "Unauthorized." }, { status: 401 });
  }
  const phone = phoneFromEmail(session.user.email);
  if (!phone) {
    return Response.json(
      { ok: false, error: "Reset codes go to WhatsApp numbers only." },
      { status: 400 },
    );
  }

  const OTP_COOLDOWN_MS = 60_000;
  const { db } = getDb();
  const person = await db.query.user.findFirst({
    where: (u, { eq }) => eq(u.id, session.user.id),
    columns: { resetOtpExpiresAt: true },
  });
  if (person?.resetOtpExpiresAt) {
    const requestedAt =
      person.resetOtpExpiresAt.getTime() - OTP_TTL_MS;
    const waitMs = OTP_COOLDOWN_MS - (Date.now() - requestedAt);
    if (waitMs > 0) {
      return Response.json(
        {
          ok: false,
          error: "A code was just sent. Wait a moment before retrying.",
          retryAfter: Math.ceil(waitMs / 1000),
        },
        { status: 429 },
      );
    }
  }

  const otp = makeOtp();
  await db
    .update(schema.user)
    .set({
      resetOtpHash: await hashOtp(otp, session.user.id),
      resetOtpExpiresAt: new Date(Date.now() + OTP_TTL_MS),
      resetOtpAttempts: 0,
      updatedAt: new Date(),
    })
    .where(eq(schema.user.id, session.user.id));

  const delivered = await sendWhatsApp(
    phone,
    `*Your Amana PIN reset code: ${otp}*\n\n_Expires in 10 minutes. Never share it._`,
  );
  return Response.json({ ok: true, delivered });
}
