import { envString } from "@/lib/db";

/**
 * GET /api/mirror — worker proxy for the backend proof-of-liability
 * report (Azure is unreachable from browsers in prod). Powers the
 * AMANA row in the dashboard price widget.
 */
export async function GET() {
  const base = envString("AZURE_BACKEND_URL").replace(/\/$/, "");
  const shared = envString("SHARED_SECRET");
  if (!base) {
    return Response.json({ ok: false, error: "Backend not configured." }, { status: 502 });
  }
  try {
    const res = await fetch(`${base}/health/mirror`, {
      headers: shared ? { "x-amana-secret": shared } : {},
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) {
      return Response.json({ ok: false, error: "Mirror check failed." }, { status: 502 });
    }
    return Response.json(await res.json());
  } catch {
    return Response.json({ ok: false, error: "Backend unreachable." }, { status: 502 });
  }
}
