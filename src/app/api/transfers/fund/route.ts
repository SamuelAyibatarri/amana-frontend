import { randomUUID } from "node:crypto";
import * as schema from "@/db/schema";
import { envString, getDb } from "@/lib/db";
import { signaturesEqual } from "@/lib/webhook";

/**
 * POST /api/transfers/fund { phone, amount, currency, reference }
 * Records fiat on-ramp value: Paystack is the funder (senderPhone),
 * the user is the recipient. Guarded by SHARED_SECRET.
 */
export async function POST(request: Request) {
  if (!signaturesEqual(request.headers.get("x-amana-secret") ?? "", envString("SHARED_SECRET"))) {
    return Response.json({ ok: false, error: "Unauthorized." }, { status: 401 });
  }
  let body: {
    phone?: unknown;
    amount?: unknown;
    currency?: unknown;
    reference?: unknown;
  };
  try {
    body = await request.json();
  } catch {
    return Response.json(
      { ok: false, error: "Request body must be JSON." },
      { status: 400 },
    );
  }
  const phone =
    typeof body.phone === "string" ? body.phone.replace(/\D/g, "") : "";
  const currency =
    body.currency === "SOL" || body.currency === "USDC" ? body.currency : null;
  const amount =
    typeof body.amount === "number" && Number.isFinite(body.amount) && body.amount > 0
      ? body.amount
      : 0;
  const reference = typeof body.reference === "string" ? body.reference : "";
  if (!phone || !currency || !amount || !reference) {
    return Response.json({ ok: false, error: "Bad fund record." }, { status: 400 });
  }
  const { db } = getDb();
  const email = `${phone}@amana.whatsapp`;
  let person = await db.query.user.findFirst({
    where: (u, { eq }) => eq(u.email, email),
    columns: { id: true },
  });
  if (!person) {
    return Response.json({ ok: false, error: "Unknown user." }, { status: 404 });
  }
  const DECIMALS: Record<string, number> = { SOL: 9, USDC: 6 };
  const amountMinor = Math.round(amount * 10 ** DECIMALS[currency]!);
  if (amountMinor <= 0) {
    return Response.json({ ok: false, error: "Dust amount." }, { status: 400 });
  }
  // Idempotent on Paystack reference: retries/replays never double-fund.
  const dupe = await db.query.transfer.findFirst({
    where: (t, { eq }) => eq(t.id, `fund-${reference}`),
    columns: { id: true },
  });
  if (dupe) {
    return Response.json({ ok: true, transferId: dupe.id, duplicate: true });
  }
  const now = new Date();
  await db.insert(schema.transfer).values({
    id: `fund-${reference}`,
    senderUserId: null,
    recipientUserId: person.id,
    senderPhone: "PAYSTACK",
    recipientPhone: phone,
    recipientAddress: null,
    amountMinor,
    currency,
    status: "completed",
    createdAt: now,
    updatedAt: now,
  });
  return Response.json({ ok: true, transferId: `fund-${reference}` });
}
