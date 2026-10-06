import { randomUUID } from "node:crypto";
import * as schema from "@/db/schema";
import { envString, getDb } from "@/lib/db";
import { signaturesEqual } from "@/lib/webhook";

/**
 * POST /api/transfers/withdraw { senderPhone, address, amountMinor, currency }
 * Records an on-chain withdrawal (already landed — the backend calls this
 * after confirmation). Guarded by SHARED_SECRET; same trust as /credit.
 */
export async function POST(request: Request) {
  if (!signaturesEqual(request.headers.get("x-amana-secret") ?? "", envString("SHARED_SECRET"))) {
    return Response.json({ ok: false, error: "Unauthorized." }, { status: 401 });
  }
  let body: {
    senderPhone?: unknown;
    address?: unknown;
    amountMinor?: unknown;
    currency?: unknown;
    signature?: unknown;
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
    typeof body.senderPhone === "string" ? body.senderPhone.replace(/\D/g, "") : "";
  const address = typeof body.address === "string" ? body.address.trim() : "";
  const amountMinor =
    typeof body.amountMinor === "number" && Number.isInteger(body.amountMinor) && body.amountMinor > 0
      ? body.amountMinor
      : 0;
  const currency = body.currency === "SOL" || body.currency === "USDC" || body.currency === "NGN" ? body.currency : null;
  const signature = typeof body.signature === "string" ? body.signature : null;
  if (!senderPhone || !address || !amountMinor || !currency) {
    return Response.json({ ok: false, error: "Bad withdrawal record." }, { status: 400 });
  }
  const { db } = getDb();
  const sender = await db.query.user.findFirst({
    where: (u, { eq }) => eq(u.email, `${senderPhone}@amana.whatsapp`),
    columns: { id: true },
  });
  if (!sender) {
    return Response.json({ ok: false, error: "Unknown sender." }, { status: 404 });
  }
  const id = randomUUID();
  const now = new Date();
  await db.insert(schema.transfer).values({
    id,
    senderUserId: sender.id,
    recipientUserId: sender.id,
    senderPhone,
    recipientAddress: address,
    amountMinor,
    currency,
    status: "withdrawn",
    createdAt: now,
    updatedAt: now,
  });
  void signature;
  return Response.json({ ok: true, transferId: id });
}
