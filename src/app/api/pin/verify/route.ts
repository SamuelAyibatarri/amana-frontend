import { eq } from "drizzle-orm";
import * as schema from "@/db/schema";
import { envString, getDb } from "@/lib/db";
import { PIN_LOCK_MS, PIN_MAX_ATTEMPTS, PIN_RE, checkPin } from "@/lib/pin";

/**
 * POST /api/pin/verify { phone, pin } — bot clearance branch for PINs.
 * Secret-guarded (`x-amana-secret`), same trust pattern as the KYC status
 * branch. Never reveals whether the PIN was close: `verified` or not.
 *
 * Lockout: 5 wrong attempts locks the credential for 15 minutes.
 */
export async function POST(request: Request) {
  const botSecret = request.headers.get("x-amana-secret");
  const secret = envString("SHARED_SECRET");
  if (!secret || botSecret !== secret) {
    return Response.json({ ok: false, error: "Unauthorized." }, { status: 401 });
  }

  let body: { phone?: unknown; pin?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json(
      { ok: false, error: "Request body must be JSON { phone, pin }." },
      { status: 400 },
    );
  }
  const phone = typeof body.phone === "string" ? body.phone.replace(/\D/g, "") : "";
  const pin = typeof body.pin === "string" ? body.pin.trim() : "";
  if (!phone || !PIN_RE.test(pin)) {
    return Response.json({ ok: false, error: "Bad request." }, { status: 400 });
  }

  const { db } = getDb();
  const person = await db.query.user.findFirst({
    where: (u, { eq }) => eq(u.email, `${phone}@amana.whatsapp`),
  });
  if (!person || !person.pinHash) {
    return Response.json({ ok: false, noPin: true });
  }
  if (person.pinLockedUntil && person.pinLockedUntil.getTime() > Date.now()) {
    return Response.json({ ok: false, locked: true });
  }

  const good = await checkPin(pin, person.id, person.pinHash);
  if (good) {
    await db
      .update(schema.user)
      .set({ pinAttempts: 0, pinLockedUntil: null, updatedAt: new Date() })
      .where(eq(schema.user.id, person.id));
    return Response.json({ ok: true, verified: true });
  }

  const attempts = (person.pinAttempts ?? 0) + 1;
  const locked = attempts >= PIN_MAX_ATTEMPTS;
  await db
    .update(schema.user)
    .set({
      pinAttempts: attempts,
      pinLockedUntil: locked ? new Date(Date.now() + PIN_LOCK_MS) : null,
      updatedAt: new Date(),
    })
    .where(eq(schema.user.id, person.id));
  return Response.json({ ok: false, locked });
}
