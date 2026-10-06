import * as schema from "@/db/schema";
import { envString, getDb } from "@/lib/db";
import { signaturesEqual } from "@/lib/webhook";

/**
 * POST /api/requests/mine { phone } — requester's latest pending
 * outgoing request (powers chat "cancel request"). Bot-guarded.
 */
export async function POST(request: Request) {
  const secret = envString("SHARED_SECRET");
  if (
    !secret ||
    !signaturesEqual(request.headers.get("x-amana-secret") ?? "", secret)
  ) {
    return Response.json({ ok: false, error: "Unauthorized." }, { status: 401 });
  }
  let body: { phone?: unknown };
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
  const req = await db.query.moneyRequest.findFirst({
    where: (r, { eq, and }) =>
      and(eq(r.requesterPhone, phone), eq(r.status, "pending")),
    orderBy: (r, { desc }) => desc(r.createdAt),
  });
  if (!req) return Response.json({ ok: true, request: null });
  return Response.json({
    ok: true,
    request: {
      id: req.id,
      recipientPhone: req.recipientPhone,
      amountMinor: req.amountMinor,
      currency: req.currency,
    },
  });
}
