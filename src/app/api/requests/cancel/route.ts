import { eq } from "drizzle-orm";
import * as schema from "@/db/schema";
import { envString, getDb } from "@/lib/db";
import { signaturesEqual } from "@/lib/webhook";

/**
 * POST /api/requests/cancel { id, phone } — requester withdraws a
 * pending request. Only the requester, only while pending.
 */
export async function POST(request: Request) {
  const secret = envString("SHARED_SECRET");
  if (
    !secret ||
    !signaturesEqual(request.headers.get("x-amana-secret") ?? "", secret)
  ) {
    return Response.json({ ok: false, error: "Unauthorized." }, { status: 401 });
  }
  let body: { id?: unknown; phone?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json(
      { ok: false, error: "Request body must be JSON." },
      { status: 400 },
    );
  }
  const id = typeof body.id === "string" ? body.id : "";
  const phone =
    typeof body.phone === "string" ? body.phone.replace(/\D/g, "") : "";
  if (!id || !phone) {
    return Response.json({ ok: false, error: "Bad request." }, { status: 400 });
  }
  const { db } = getDb();
  const req = await db.query.moneyRequest.findFirst({
    where: (r, { eq }) => eq(r.id, id),
  });
  if (!req || req.requesterPhone !== phone) {
    return Response.json({ ok: false, error: "Not found." }, { status: 404 });
  }
  if (req.status !== "pending") {
    return Response.json({ ok: true, status: req.status, replay: true });
  }
  await db
    .update(schema.moneyRequest)
    .set({ status: "cancelled", updatedAt: new Date() })
    .where(eq(schema.moneyRequest.id, id));
  return Response.json({
    ok: true,
    status: "cancelled",
    recipientPhone: req.recipientPhone,
  });
}
