import { getAuthInstance } from "@/lib/auth";
import { envString, getDb } from "@/lib/db";

/**
 * GET /api/payments/status?reference=<ref>
 *
 * Pollable completion check for the UI and the Azure bot.
 * Same dual auth as initialize: session cookie, or
 * `x-amana-secret: <SHARED_SECRET>` for bot polling.
 *
 * Session callers can only see their own rows; bot callers must
 * present the exact reference (unguessable `amana-<time>-<rand>`).
 * Never exposes email or metadata — status only.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const reference = url.searchParams.get("reference")?.trim() ?? "";
  if (!reference) {
    return Response.json(
      { ok: false, error: "reference query param is required." },
      { status: 400 },
    );
  }

  const sharedSecret = envString("SHARED_SECRET");
  const callerSecret = request.headers.get("x-amana-secret");
  const isBotCall =
    !!sharedSecret && !!callerSecret && callerSecret === sharedSecret;

  let userId: string | null = null;
  if (!isBotCall) {
    const auth = await getAuthInstance();
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session) {
      return Response.json({ ok: false, error: "Unauthorized." }, { status: 401 });
    }
    userId = session.user.id;
  }

  const { db } = getDb();
  const payment = await db.query.payment.findFirst({
    where: (p, { eq }) => eq(p.reference, reference),
  });

  if (!payment || (userId && payment.userId !== userId)) {
    return Response.json({ ok: false, error: "Payment not found." }, { status: 404 });
  }

  return Response.json({
    ok: true,
    reference: payment.reference,
    status: payment.status,
    amountKobo: payment.amount,
    currency: payment.currency,
    channel: payment.channel,
    paidAt: payment.paidAt,
  });
}
