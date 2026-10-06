import { and, eq } from "drizzle-orm";
import * as schema from "@/db/schema";
import { envString, getDb } from "@/lib/db";
import { signaturesEqual } from "@/lib/webhook";

const MODES = ["open", "contacts", "blocked"] as const;

/**
 * POST /api/requests/settings { phone, privacy?, unblock? }
 * Privacy: open (anyone) | contacts (prior transfers only) | blocked (nobody).
 * Unblock removes one blocklist row. Bot-guarded; identity is the sender.
 */
export async function POST(request: Request) {
  const secret = envString("SHARED_SECRET");
  if (
    !secret ||
    !signaturesEqual(request.headers.get("x-amana-secret") ?? "", secret)
  ) {
    return Response.json({ ok: false, error: "Unauthorized." }, { status: 401 });
  }
  let body: { phone?: unknown; privacy?: unknown; unblock?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json(
      { ok: false, error: "Request body must be JSON." },
      { status: 400 },
    );
  }
  const phone =
    typeof body.phone === "string" ? body.phone.replace(/\D/g, "") : "";
  if (!phone) {
    return Response.json({ ok: false, error: "Bad request." }, { status: 400 });
  }
  const { db } = getDb();
  const person = await db.query.user.findFirst({
    where: (u, { eq }) => eq(u.email, `${phone}@amana.whatsapp`),
  });
  if (!person) {
    return Response.json({ ok: false, error: "Unknown user." }, { status: 404 });
  }
  const now = new Date();
  if (
    typeof body.privacy === "string" &&
    (MODES as readonly string[]).includes(body.privacy)
  ) {
    await db
      .update(schema.user)
      .set({ requestPrivacy: body.privacy, updatedAt: now })
      .where(eq(schema.user.id, person.id));
    return Response.json({ ok: true, privacy: body.privacy });
  }
  if (typeof body.unblock === "string") {
    const target = body.unblock.replace(/\D/g, "");
    if (!target) {
      return Response.json({ ok: false, error: "Bad request." }, { status: 400 });
    }
    await db
      .delete(schema.requestBlock)
      .where(
        and(
          eq(schema.requestBlock.blockerUserId, person.id),
          eq(schema.requestBlock.blockedPhone, target),
        ),
      );
    return Response.json({ ok: true, unblocked: target });
  }
  return Response.json({ ok: false, error: "Bad request." }, { status: 400 });
}
