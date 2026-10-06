import { eq } from "drizzle-orm";
import * as schema from "@/db/schema";
import { envString, getDb } from "@/lib/db";
import { signaturesEqual } from "@/lib/webhook";

/**
 * POST /api/requests/respond { id, phone, action }
 * action: accept | reject | reject-block. Only the named recipient may
 * respond, and only while pending (double-accepts are idempotent no-ops).
 * Accept returns execution details (bot collects the recipient's PIN,
 * credits via /transfers/credit, then finalizes — see finalize below).
 * Reject-block records the blocklist silently.
 */
export async function POST(request: Request) {
  const secret = envString("SHARED_SECRET");
  if (
    !secret ||
    !signaturesEqual(request.headers.get("x-amana-secret") ?? "", secret)
  ) {
    return Response.json({ ok: false, error: "Unauthorized." }, { status: 401 });
  }
  let body: { id?: unknown; phone?: unknown; action?: unknown; finalize?: unknown };
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
  const action = body.action;
  if (
    !id ||
    !phone ||
    (action !== "accept" &&
      action !== "reject" &&
      action !== "reject-block" &&
      action !== "finalize-accept")
  ) {
    return Response.json({ ok: false, error: "Bad request." }, { status: 400 });
  }

  const { db } = getDb();
  const req = await db.query.moneyRequest.findFirst({
    where: (r, { eq }) => eq(r.id, id),
  });
  if (!req || req.recipientPhone !== phone) {
    return Response.json({ ok: false, error: "Not found." }, { status: 404 });
  }
  if (req.status !== "pending") {
    // Idempotent replays: report terminal state, move nothing.
    return Response.json({ ok: true, status: req.status, replay: true });
  }

  const now = new Date();
  if (action === "reject" || action === "reject-block") {
    await db
      .update(schema.moneyRequest)
      .set({ status: "rejected", updatedAt: now })
      .where(eq(schema.moneyRequest.id, id));
    if (action === "reject-block") {
      await db.insert(schema.requestBlock).values({
        id: crypto.randomUUID(),
        blockerUserId: req.recipientUserId ?? req.requesterUserId,
        blockedPhone: req.requesterPhone,
        createdAt: now,
      });
    }
    return Response.json({
      ok: true,
      status: "rejected",
      blocked: action === "reject-block",
      requesterPhone: req.requesterPhone,
    });
  }

  // Accept path is two-phase: first call returns execution details for the
  // recipient PIN ceremony; the bot calls back with finalize-accept AFTER
  // a successful /transfers/credit so a failed credit never marks accepted.
  if (action === "accept") {
    return Response.json({
      ok: true,
      status: "pending",
      request: {
        id: req.id,
        requesterPhone: req.requesterPhone,
        amountMinor: req.amountMinor,
        currency: req.currency,
        sendNgn: req.sendNgn,
      },
    });
  }

  await db
    .update(schema.moneyRequest)
    .set({ status: "accepted", updatedAt: now })
    .where(eq(schema.moneyRequest.id, id));
  return Response.json({
    ok: true,
    status: "accepted",
    requesterPhone: req.requesterPhone,
  });
}
