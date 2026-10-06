import { sql } from "drizzle-orm";
import * as schema from "@/db/schema";
import { getAuthInstance } from "@/lib/auth";
import { getDb } from "@/lib/db";

/**
 * GET /api/balance/mine — signed-in user's net position per currency
 * (received − sent − withdrawn), minor units. Same math as the bot's
 * /transfers/balance, keyed by session instead of phone.
 */
export async function GET(request: Request) {
  const auth = await getAuthInstance();
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) {
    return Response.json({ ok: false, error: "Unauthorized." }, { status: 401 });
  }
  const { db } = getDb();
  const userId = session.user.id;
  const rows = await db
    .select({
      currency: schema.transfer.currency,
      status: schema.transfer.status,
      inbound: sql<number>`sum(case when ${schema.transfer.recipientUserId} = ${userId} and ${schema.transfer.status} != 'withdrawn' then ${schema.transfer.amountMinor} else 0 end)`,
      outbound: sql<number>`sum(case when ${schema.transfer.senderUserId} = ${userId} then ${schema.transfer.amountMinor} else 0 end)`,
    })
    .from(schema.transfer)
    .groupBy(schema.transfer.currency, schema.transfer.status);
  const balances: Record<string, number> = { SOL: 0, USDC: 0, NGN: 0 };
  for (const row of rows) {
    if (!(row.currency in balances)) continue;
    balances[row.currency]! += Number(row.inbound ?? 0) - Number(row.outbound ?? 0);
  }
  for (const k of Object.keys(balances)) {
    if (balances[k]! < 0) balances[k] = 0;
  }
  return Response.json({ ok: true, balances });
}
