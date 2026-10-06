import { sql } from "drizzle-orm";
import * as schema from "@/db/schema";
import { envString, getDb } from "@/lib/db";
import { signaturesEqual } from "@/lib/webhook";

/**
 * GET /api/transfers/sums — net liabilities per currency
 * (completed credits minus recorded withdrawals), in minor units.
 * Guarded by SHARED_SECRET. Feeds the backend proof-of-liability check.
 */
export async function GET(request: Request) {
  if (!signaturesEqual(request.headers.get("x-amana-secret") ?? "", envString("SHARED_SECRET"))) {
    return Response.json({ ok: false, error: "Unauthorized." }, { status: 401 });
  }
  const { db } = getDb();
  const rows = await db
    .select({
      currency: schema.transfer.currency,
      status: schema.transfer.status,
      total: sql<number>`sum(${schema.transfer.amountMinor})`,
    })
    .from(schema.transfer)
    .groupBy(schema.transfer.currency, schema.transfer.status);
  const sums: Record<string, number> = { SOL: 0, USDC: 0, NGN: 0 };
  for (const row of rows) {
    if (!(row.currency in sums)) continue;
    const sign = row.status === "withdrawn" ? -1 : 1;
    sums[row.currency]! += sign * Number(row.total ?? 0);
  }
  return Response.json({ ok: true, sums });
}
