import { eq } from "drizzle-orm";
import * as schema from "@/db/schema";
import { envString, getDb } from "@/lib/db";
import { signaturesEqual } from "@/lib/webhook";

const EXPIRY_MS = 7 * 24 * 60 * 60 * 1_000;
const NUDGE_AFTER_MS = 24 * 60 * 60 * 1_000;

/**
 * POST /api/requests/sweep — bot tick (every 5 min, same timer as alerts).
 * Expires pending requests older than 7 days (silent), and returns those
 * due their single 24h nudge — marking them nudged in the same pass so a
 * second tick never double-nudges.
 */
export async function POST(request: Request) {
  const secret = envString("SHARED_SECRET");
  if (
    !secret ||
    !signaturesEqual(request.headers.get("x-amana-secret") ?? "", secret)
  ) {
    return Response.json({ ok: false, error: "Unauthorized." }, { status: 401 });
  }
  const { db } = getDb();
  const now = new Date();
  const expiredBefore = new Date(now.getTime() - EXPIRY_MS);
  const nudgeBefore = new Date(now.getTime() - NUDGE_AFTER_MS);

  const pendings = await db.query.moneyRequest.findMany({
    where: eq(schema.moneyRequest.status, "pending"),
  });

  let expired = 0;
  const nudge: Array<{
    id: string;
    requesterPhone: string;
    recipientPhone: string;
    amountMinor: number;
    currency: string;
  }> = [];
  for (const r of pendings) {
    // Belt + suspenders: only pendings move, even if the filter misbehaves.
    if (r.status !== "pending") continue;    if (r.createdAt < expiredBefore) {
      await db
        .update(schema.moneyRequest)
        .set({ status: "expired", updatedAt: now })
        .where(eq(schema.moneyRequest.id, r.id));
      expired++;
    } else if (!r.nudgedAt && r.createdAt < nudgeBefore) {
      await db
        .update(schema.moneyRequest)
        .set({ nudgedAt: now, updatedAt: now })
        .where(eq(schema.moneyRequest.id, r.id));
      nudge.push({
        id: r.id,
        requesterPhone: r.requesterPhone,
        recipientPhone: r.recipientPhone,
        amountMinor: r.amountMinor,
        currency: r.currency,
      });
    }
  }
  return Response.json({ ok: true, expired, nudge });
}
