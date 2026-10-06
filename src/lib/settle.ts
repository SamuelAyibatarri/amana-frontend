import { envString } from "@/lib/db";

export interface BuyMeta {
  kind?: unknown;
  phone?: unknown;
  asset?: unknown;
  crypto?: unknown;
  rateLabel?: unknown;
  ngn?: unknown;
  amountKobo?: unknown;
}

/**
 * Shared buy-settlement delegation: worker verifies, Azure settles
 * (ledger fund + mirror mint + WhatsApp receipt). Used by the Paystack
 * webhook and the manual /payments/check route — one funnel, idempotent
 * on reference either way.
 */
export async function delegateSettle(
  reference: string,
  meta: BuyMeta,
): Promise<boolean> {
  if (meta?.kind !== "buy" || typeof meta.phone !== "string") return false;
  const backend = envString("AZURE_BACKEND_URL").replace(/\/$/, "");
  const shared = envString("SHARED_SECRET");
  if (!backend || !shared) return false;
  try {
    const settle = await fetch(`${backend}/buy/settle`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-amana-secret": shared,
      },
      body: JSON.stringify({
        reference,
        phone: meta.phone,
        asset: meta.asset,
        crypto: meta.crypto,
        rateLabel: meta.rateLabel,
        ngn: meta.ngn,
        amountKobo: meta.amountKobo,
      }),
      signal: AbortSignal.timeout(20_000),
    });
    console.log(`[settle] Delegated: ${reference} → ${settle.status}`);
    return settle.ok;
  } catch (err) {
    console.error(
      `[settle] Delegation failed: ${reference}`,
      err instanceof Error ? err.message : err,
    );
    return false;
  }
}
