import { sql } from "drizzle-orm";
import * as schema from "@/db/schema";
import { envString, getDb } from "@/lib/db";
import { signaturesEqual } from "@/lib/webhook";

/**
 * GET /api/transfers/balance?phone=234... — net position per currency
 * (received − sent − withdrawn), in minor units. Bot-guarded.
 * The debit-gating source of truth: sends refuse above these numbers.
 */
export async function GET(request: Request) {
  if (!signaturesEqual(request.headers.get("x-amana-secret") ?? "", envString("SHARED_SECRET"))) {
    return Response.json({ ok: false, error: "Unauthorized." }, { status: 401 });
  }
  const { searchParams } = new URL(request.url);
  const phone = (searchParams.get("phone") ?? "").replace(/\D/g, "");
  if (!phone) {
    return Response.json({ ok: false, error: "Bad phone." }, { status: 400 });
  }
  const { db } = getDb();
  const person = await db.query.user.findFirst({
    where: (u, { eq }) => eq(u.email, `${phone}@amana.whatsapp`),
    columns: { id: true },
  });
  if (!person) {
    return Response.json({
      ok: true,
      balances: { SOL: 0, USDC: 0, NGN: 0 },
    });
  }
  const rows = await db
    .select({
      currency: schema.transfer.currency,
      status: schema.transfer.status,
      inbound: sql<number>`sum(case when ${schema.transfer.recipientUserId} = ${person.id} and ${schema.transfer.status} != 'withdrawn' then ${schema.transfer.amountMinor} else 0 end)`,
      outbound: sql<number>`sum(case when ${schema.transfer.senderUserId} = ${person.id} then ${schema.transfer.amountMinor} else 0 end)`,
    })
    .from(schema.transfer)
    .groupBy(schema.transfer.currency, schema.transfer.status);
  const balances: Record<string, number> = { SOL: 0, USDC: 0, NGN: 0 };
  for (const row of rows) {
    if (!(row.currency in balances)) continue;
    // Withdrawals are recorded with the user as sender — outbound by
    // construction. Fund rows (PAYSTACK sender) are inbound only.
    balances[row.currency]! += Number(row.inbound ?? 0) - Number(row.outbound ?? 0);
  }
  for (const k of Object.keys(balances)) {
    if (balances[k]! < 0) balances[k] = 0;
  }
  return Response.json({ ok: true, balances });
}
