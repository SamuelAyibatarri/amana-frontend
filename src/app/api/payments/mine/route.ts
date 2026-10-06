import { desc, eq, or } from "drizzle-orm";
import * as schema from "@/db/schema";
import { getAuthInstance } from "@/lib/auth";
import { getDb } from "@/lib/db";

/**
 * GET /api/payments/mine — the signed-in user's money story, newest first:
 * Paystack fundings plus internal transfers (sent and received).
 * Amounts are smallest units (see DECIMALS per currency on the client).
 */
export async function GET(request: Request) {
  const auth = await getAuthInstance();
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) {
    return Response.json({ ok: false, error: "Unauthorized." }, { status: 401 });
  }
  const { db } = getDb();
  const rows = await db
    .select({
      reference: schema.payment.reference,
      amount: schema.payment.amount,
      currency: schema.payment.currency,
      status: schema.payment.status,
      channel: schema.payment.channel,
      paidAt: schema.payment.paidAt,
      createdAt: schema.payment.createdAt,
    })
    .from(schema.payment)
    .where(eq(schema.payment.userId, session.user.id))
    .orderBy(desc(schema.payment.createdAt))
    .limit(20);
  const transfers = await db
    .select({
      senderUserId: schema.transfer.senderUserId,
      senderPhone: schema.transfer.senderPhone,
      recipientPhone: schema.transfer.recipientPhone,
      amountMinor: schema.transfer.amountMinor,
      currency: schema.transfer.currency,
      status: schema.transfer.status,
      createdAt: schema.transfer.createdAt,
    })
    .from(schema.transfer)
    .where(
      or(
        eq(schema.transfer.senderUserId, session.user.id),
        eq(schema.transfer.recipientUserId, session.user.id),
      ),
    )
    .orderBy(desc(schema.transfer.createdAt))
    .limit(20);
  return Response.json({
    ok: true,
    payments: rows.map((r) => ({
      ...r,
      kind: "funding" as const,
      paidAt: r.paidAt ? r.paidAt.getTime() : null,
      createdAt: r.createdAt ? r.createdAt.getTime() : null,
    })),
    transfers: transfers.map((t) => ({
      kind: "transfer" as const,
      direction: t.senderUserId === session.user.id ? "sent" : "received",
      counterparty:
        t.senderUserId === session.user.id ? t.recipientPhone : t.senderPhone,
      amountMinor: t.amountMinor,
      currency: t.currency,
      status: t.status,
      createdAt: t.createdAt ? t.createdAt.getTime() : null,
    })),
  });
}
