import { eq } from "drizzle-orm";
import * as schema from "@/db/schema";
import { getDb, envString } from "@/lib/db";
import {
  verifyPaystackSignature,
  paystackEventToStatus,
  type PaystackWebhookEvent,
} from "@/lib/paystack";
import { delegateSettle } from "@/lib/settle";

/**
 * POST /api/webhooks/paystack
 *
 * Paystack charge webhook. Pattern mirrors
 * `bizzo-ride-backend/src/routes/webhooks.ts`:
 * raw-body SHA512 verify → parse → idempotency on `reference` →
 * D1 `pending → completed/failed`.
 *
 * Unknown references and non-charge events are acknowledged (200) without
 * writes so Paystack doesn't retry-storm us. Already-settled rows are
 * acknowledged without changes — once-only crediting.
 */
export async function POST(request: Request) {
  const secretKey = envString("PAYSTACK_SECRET_KEY");
  if (!secretKey) {
    console.error("[webhooks/paystack] PAYSTACK_SECRET_KEY is not configured.");
    return Response.json(
      { ok: false, error: "Payments are not configured." },
      { status: 500 },
    );
  }

  const signature = request.headers.get("x-paystack-signature");
  if (!signature) {
    return Response.json(
      { ok: false, error: "Missing x-paystack-signature." },
      { status: 401 },
    );
  }

  const rawBody = await request.text();
  if (!rawBody) {
    return Response.json({ ok: false, error: "Empty body." }, { status: 400 });
  }

  const valid = await verifyPaystackSignature(rawBody, secretKey, signature);
  if (!valid) {
    console.warn("[webhooks/paystack] Invalid signature.");
    return Response.json({ ok: false, error: "Invalid signature." }, { status: 401 });
  }

  let event: PaystackWebhookEvent;
  try {
    event = JSON.parse(rawBody) as PaystackWebhookEvent;
  } catch {
    return Response.json({ ok: false, error: "Invalid JSON." }, { status: 400 });
  }

  const reference = event.data?.reference;
  if (!reference) {
    return Response.json(
      { ok: false, error: "Missing reference." },
      { status: 400 },
    );
  }

  const nextStatus = paystackEventToStatus(event);
  if (!nextStatus) {
    return Response.json({ ok: true, matched: true, ignored: event.event });
  }

  const { db } = getDb();
  const existing = await db.query.payment.findFirst({
    where: (p, { eq }) => eq(p.reference, reference),
  });

  if (!existing) {
    console.warn(`[webhooks/paystack] Unknown reference: ${reference}`);
    return Response.json({ ok: true, matched: false });
  }

  if (existing.status !== "pending") {
    return Response.json({ ok: true, matched: true, alreadyProcessed: true });
  }

  const now = new Date();
  const channel =
    typeof event.data.channel === "string" ? event.data.channel : null;
  const paidAt =
    nextStatus === "completed"
      ? event.data.paid_at
        ? new Date(event.data.paid_at)
        : now
      : null;

  await db
    .update(schema.payment)
    .set({ status: nextStatus, channel, paidAt, updatedAt: now })
    .where(eq(schema.payment.id, existing.id));

  console.log(
    `[webhooks/paystack] Payment ${nextStatus}: ${reference} (${existing.amount} kobo)`,
  );

  // Chat buys settle on the Azure backend: ledger fund + mirror mint +
  // WhatsApp receipt. Delegated (worker can't sign); backend guards +
  // dedupes. Webhook stays 200 regardless — money is never retried into.
  if (nextStatus === "completed") {
    try {
      const meta = existing.metadata ? JSON.parse(existing.metadata) : null;
      await delegateSettle(reference, { ...meta, amountKobo: existing.amount });
    } catch (err) {
      console.error(
        `[webhooks/paystack] Settle delegation failed: ${reference}`,
        err instanceof Error ? err.message : err,
      );
    }
  }
  return Response.json({ ok: true, matched: true, status: nextStatus });
}
