import * as schema from "@/db/schema";
import { getAuthInstance } from "@/lib/auth";
import { envString, getDb } from "@/lib/db";
import { signaturesEqual } from "@/lib/webhook";

const MIN_AMOUNT_KOBO = 10000; // ₦100 floor keeps test noise out

interface InitializeBody {
  amountKobo?: unknown;
  email?: unknown;
  metadata?: unknown;
}

function badRequest(message: string, status = 400) {
  return Response.json({ ok: false, error: message }, { status });
}

/**
 * Paystack rejects non-public TLDs (our internal `phone@amana.whatsapp`
 * identity fails its email validation). Internal identity is untouched —
 * only the Paystack customer field gets a format-valid alias.
 */
function paystackEmail(email: string): string {
  const [local] = email.split("@");
  return email.endsWith("@amana.whatsapp") && local
    ? `${local}@customers.amana.ng`
    : email;
}

/**
 * POST /api/payments/initialize { amountKobo, email?, metadata? }
 *
 * Two callers, one contract:
 * - Web-initiated: Better Auth session cookie; email/userId from session.
 * - Chat-initiated (Azure bot): `x-amana-secret: <SHARED_SECRET>` header;
 *   email required in body (the bot user's verified address).
 *
 * Calls Paystack `transaction/initialize` with the server-side test secret,
 * writes the pending row to D1, and returns the checkout URL. The secret
 * key never leaves the Worker.
 */
export async function POST(request: Request) {
  const secretKey = envString("PAYSTACK_SECRET_KEY");
  if (!secretKey) {
    console.error(
      "[payments/initialize] PAYSTACK_SECRET_KEY is not configured.",
    );
    return badRequest("Payments are not configured.", 500);
  }

  const sharedSecret = envString("SHARED_SECRET");
  const callerSecret = request.headers.get("x-amana-secret") ?? "";
  const isBotCall =
    !!sharedSecret && signaturesEqual(callerSecret, sharedSecret);

  let body: InitializeBody;
  try {
    body = (await request.json()) as InitializeBody;
  } catch {
    return badRequest("Request body must be JSON.");
  }

  const amountKobo =
    typeof body.amountKobo === "number"
      ? Math.floor(body.amountKobo)
      : NaN;
  if (!Number.isFinite(amountKobo) || amountKobo < MIN_AMOUNT_KOBO) {
    return badRequest(
      `amountKobo must be an integer of at least ${MIN_AMOUNT_KOBO} (₦100).`,
    );
  }

  let userId: string;
  let email: string;
  if (isBotCall) {
    email =
      typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    if (!email || !email.includes("@")) {
      return badRequest("email is required for bot-initiated payments.");
    }
    const { db } = getDb();
    const existing = await db.query.user.findFirst({
      where: (u, { eq }) => eq(u.email, email),
    });
    if (!existing) {
      return badRequest("No verified user for that email.", 404);
    }
    userId = existing.id;
  } else {
    const auth = await getAuthInstance();
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session) {
      return badRequest("Unauthorized.", 401);
    }
    userId = session.user.id;
    email = session.user.email;
    // Web funding settles like a chat buy: derive the phone server-side
    // and stamp buy metadata so the webhook settles the ledger + mirror.
    // Without this, web payments complete with no ledger credit (stranded).
    if (!isBotCall && email.endsWith("@amana.whatsapp")) {
      const incoming =
        body.metadata && typeof body.metadata === "object"
          ? (body.metadata as Record<string, unknown>)
          : {};
      body.metadata = {
        ...incoming,
        kind: "buy",
        asset: incoming.asset === "USDC" ? "USDC" : "SOL",
        phone: email.replace("@amana.whatsapp", ""),
      };
    }
  }

  const reference = `amana-${Date.now().toString(36)}-${crypto
    .randomUUID()
    .replace(/-/g, "")
    .slice(0, 12)}`;

  let init: {
    status: boolean;
    message: string;
    data?: { authorization_url: string; access_code: string; reference: string };
  };
  try {
    const res = await fetch("https://api.paystack.co/transaction/initialize", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${secretKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email: paystackEmail(email),
        amount: amountKobo,
        reference,
        metadata:
          body.metadata && typeof body.metadata === "object"
            ? { ...body.metadata, userId }
            : { userId },
      }),
    });
    init = (await res.json()) as typeof init;
    if (!res.ok || !init.status || !init.data) {
      console.error("[payments/initialize] Paystack rejected init:", init.message);
      return badRequest(`Payment provider refused: ${init.message}`, 502);
    }
  } catch (err) {
    console.error(
      "[payments/initialize] Paystack request failed:",
      err instanceof Error ? err.message : err,
    );
    return badRequest("Payment provider unreachable.", 502);
  }

  const now = new Date();
  const { db } = getDb();
  try {
    await db.insert(schema.payment).values({
      id: crypto.randomUUID(),
      userId,
      reference,
      email,
      amount: amountKobo,
      currency: "NGN",
      status: "pending",
      channel: null,
      metadata:
        body.metadata && typeof body.metadata === "object"
          ? JSON.stringify(body.metadata)
          : null,
      paidAt: null,
      createdAt: now,
      updatedAt: now,
    });
  } catch (err) {
    console.error(
      "[payments/initialize] D1 insert failed:",
      err instanceof Error ? err.message : err,
    );
    return badRequest("Could not record payment.", 500);
  }

  return Response.json({
    ok: true,
    reference,
    authorization_url: init.data.authorization_url,
    access_code: init.data.access_code,
  });
}
