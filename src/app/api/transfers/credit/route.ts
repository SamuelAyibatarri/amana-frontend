import { eq } from "drizzle-orm";
import * as schema from "@/db/schema";
import { envString, getDb } from "@/lib/db";
import { signaturesEqual } from "@/lib/webhook";

const DECIMALS: Record<string, number> = { SOL: 9, USDC: 6, NGN: 2 };
const PHONE_RE = /^234[789]\d{9}$/;

/**
 * POST /api/transfers/credit — bot-only internal credit.
 * Secret-guarded (`x-amana-secret`). Finds or provisions both users by
 * phone-derived email (recipient row created unverified when absent),
 * writes a completed transfer row. Value is final at insert; withdrawal
 * stays gated on the recipient's KYC + PIN.
 */
export async function POST(request: Request) {
  const botSecret = request.headers.get("x-amana-secret") ?? "";
  const secret = envString("SHARED_SECRET");
  if (!secret || !signaturesEqual(botSecret, secret)) {
    return Response.json({ ok: false, error: "Unauthorized." }, { status: 401 });
  }

  let body: {
    senderPhone?: unknown;
    recipientPhone?: unknown;
    amount?: unknown;
    currency?: unknown;
  };
  try {
    body = await request.json();
  } catch {
    return Response.json(
      { ok: false, error: "Request body must be JSON." },
      { status: 400 },
    );
  }

  const senderPhone =
    typeof body.senderPhone === "string"
      ? body.senderPhone.replace(/\D/g, "")
      : "";
  const recipientPhone =
    typeof body.recipientPhone === "string"
      ? body.recipientPhone.replace(/\D/g, "")
      : "";
  const amount = typeof body.amount === "number" ? body.amount : NaN;
  const currency =
    body.currency === "SOL" || body.currency === "USDC" || body.currency === "NGN"
      ? body.currency
      : null;
  if (
    !PHONE_RE.test(senderPhone) ||
    !PHONE_RE.test(recipientPhone) ||
    !Number.isFinite(amount) ||
    amount <= 0 ||
    !currency
  ) {
    return Response.json({ ok: false, error: "Bad request." }, { status: 400 });
  }
  if (senderPhone === recipientPhone) {
    return Response.json(
      { ok: false, error: "Sender and recipient are the same." },
      { status: 400 },
    );
  }

  const { db } = getDb();
  const now = new Date();
  async function findOrProvision(phone: string): Promise<{ id: string; created: boolean }> {
    const email = `${phone}@amana.whatsapp`;
    const existing = await db.query.user.findFirst({
      where: (u, { eq }) => eq(u.email, email),
    });
    if (existing) return { id: existing.id, created: false };
    const id = crypto.randomUUID();
    await db.insert(schema.user).values({
      id,
      name: phone,
      email,
      emailVerified: false,
      image: null,
      createdAt: now,
      updatedAt: now,
    });
    return { id, created: true };
  }

  const sender = await findOrProvision(senderPhone);
  const recipient = await findOrProvision(recipientPhone);

  const amountMinor = Math.round(amount * 10 ** DECIMALS[currency]!);
  if (amountMinor <= 0) {
    return Response.json({ ok: false, error: "Bad request." }, { status: 400 });
  }
  const id = crypto.randomUUID();
  await db.insert(schema.transfer).values({
    id,
    senderUserId: sender.id,
    recipientUserId: recipient.id,
    senderPhone,
    recipientPhone,
    recipientAddress: null,
    amountMinor,
    currency,
    status: "completed",
    createdAt: now,
    updatedAt: now,
  });

  return Response.json({ ok: true, transferId: id, recipientCreated: recipient.created });
}
