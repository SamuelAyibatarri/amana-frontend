/**
 * GET /api/prices — SOL + USDC in USD, 5-minute worker cache.
 * Powers the dashboard price widget (client must not fan out to
 * price APIs per visit). CoinGecko first; Binance public ticker as
 * fallback (CoinGecko rate-limits shared worker egress IPs).
 */

interface Cache {
  at: number;
  solUsd: number;
  usdcUsd: number;
}

// Module-scope cache: lives as long as the worker isolate does.
let cache: Cache | null = null;
const TTL_MS = 5 * 60 * 1_000;

async function fromCoinGecko(): Promise<{ solUsd: number; usdcUsd: number }> {
  const res = await fetch(
    "https://api.coingecko.com/api/v3/simple/price?ids=solana,usd-coin&vs_currencies=usd",
    { signal: AbortSignal.timeout(8_000) },
  );
  if (!res.ok) throw new Error(`CoinGecko ${res.status}`);
  const body = (await res.json()) as {
    solana?: { usd?: number };
    ["usd-coin"]?: { usd?: number };
  };
  const solUsd = Number(body.solana?.usd);
  if (!Number.isFinite(solUsd) || solUsd <= 0) throw new Error("Bad SOL price");
  return {
    solUsd,
    usdcUsd: Number(body["usd-coin"]?.usd) > 0 ? Number(body["usd-coin"]?.usd) : 1,
  };
}

async function fromBinance(): Promise<{ solUsd: number; usdcUsd: number }> {
  const res = await fetch(
    "https://api.binance.com/api/v3/ticker/price?symbol=SOLUSDT",
    { signal: AbortSignal.timeout(8_000) },
  );
  if (!res.ok) throw new Error(`Binance ${res.status}`);
  const body = (await res.json()) as { price?: unknown };
  const solUsd = Number(body.price);
  if (!Number.isFinite(solUsd) || solUsd <= 0) throw new Error("Bad SOL price");
  return { solUsd, usdcUsd: 1 };
}

export async function GET() {
  if (cache && Date.now() - cache.at < TTL_MS) {
    return Response.json({ ok: true, ...cache, live: true, cached: true });
  }
  const attempts = [fromCoinGecko, fromBinance];
  for (const attempt of attempts) {
    try {
      const prices = await attempt();
      cache = { at: Date.now(), ...prices };
      return Response.json({ ok: true, ...cache, live: true, cached: false });
    } catch {
      // Next source.
    }
  }
  if (cache) {
    return Response.json({ ok: true, ...cache, live: false, cached: true });
  }
  return Response.json(
    { ok: false, error: "Prices unavailable." },
    { status: 502 },
  );
}
