import { eq } from "drizzle-orm";
import * as schema from "@/db/schema";
import { getAuthInstance } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { phoneFromEmail, sendWhatsApp } from "@/lib/notify";
import {
  PIN_LOCK_MS,
  PIN_MAX_ATTEMPTS,
  PIN_RE,
  checkPin,
  hashPin,
} from "@/lib/pin";

/**
 * POST /api/pin/set { pin, currentPin? } — set (or replace) the PIN.
 * First set needs no proof; replacing one requires the current PIN
 * (wrong attempts feed the same 5-strike lockout). A WhatsApp notice
 * fires on every successful change.
 */
export async function POST(request: Request) {
  const auth = await getAuthInstance();
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) {
    return Response.json({ ok: false, error: "Unauthorized." }, { status: 401 });
  }

  let body: { pin?: unknown; currentPin?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json(
      { ok: false, error: "Request body must be JSON { pin }." },
      { status: 400 },
    );
  }
  const pin = typeof body.pin === "string" ? body.pin.trim() : "";
  if (!PIN_RE.test(pin)) {
    return Response.json(
      { ok: false, error: "PIN must be exactly 4 digits." },
      { status: 400 },
    );
  }

  const { db } = getDb();
  const person = await db.query.user.findFirst({
    where: (u, { eq }) => eq(u.id, session.user.id),
  });
  if (!person) {
    return Response.json({ ok: false, error: "Unauthorized." }, { status: 401 });
  }

  if (person.pinHash) {
    const current = typeof body.currentPin === "string" ? body.currentPin.trim() : "";
    const good =
      PIN_RE.test(current) && (await checkPin(current, person.id, person.pinHash));
    if (!good) {
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
      return Response.json(
        { ok: false, error: "Current PIN is wrong.", locked },
        { status: 403 },
      );
    }
  }

  await db
    .update(schema.user)
    .set({
      pinHash: await hashPin(pin, person.id),
      pinAttempts: 0,
      pinLockedUntil: null,
      updatedAt: new Date(),
    })
    .where(eq(schema.user.id, person.id));

  const phone = phoneFromEmail(session.user.email);
  if (phone) {
    void sendWhatsApp(
      phone,
      `*Security notice: your Amana transaction PIN was just changed.*\n\n_If this wasn't you, reset it on your dashboard now._`,
    );
  }
  return Response.json({ ok: true });
}
