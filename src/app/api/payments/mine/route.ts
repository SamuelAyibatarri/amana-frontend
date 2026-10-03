import { desc, eq } from "drizzle-orm";
import * as schema from "@/db/schema";
import { getAuthInstance } from "@/lib/auth";
import { getDb } from "@/lib/db";

/**
 * GET /api/payments/mine — the signed-in user's payments, newest first.
 * Powers the dashboard transaction history. Amounts are kobo (smallest unit).
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
  return Response.json({
    ok: true,
    payments: rows.map((r) => ({
      ...r,
      paidAt: r.paidAt ? r.paidAt.getTime() : null,
      createdAt: r.createdAt ? r.createdAt.getTime() : null,
    })),
  });
}
