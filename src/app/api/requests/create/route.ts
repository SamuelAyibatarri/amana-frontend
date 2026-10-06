import * as schema from "@/db/schema";
import { envString, getDb } from "@/lib/db";
import { signaturesEqual } from "@/lib/webhook";

const PHONE_RE = /^234[789]\d{9}$/;
const CURRENCIES = ["SOL", "USDC"] as const;

function unauthorized(request: Request): boolean {
  const secret = envString("SHARED_SECRET");
  return (
    !secret ||
    !signaturesEqual(request.headers.get("x-amana-secret") ?? "", secret)
  );
}

async function findOrProvision(
  db: ReturnType<typeof getDb>["db"],
  phone: string,
  now: Date,
): Promise<{ id: string; created: boolean }> {
  const existing = await db.query.user.findFirst({
    where: (u, { eq }) => eq(u.email, `${phone}@amana.whatsapp`),
  });
  if (existing) return { id: existing.id, created: false };
  const id = crypto.randomUUID();
  await db.insert(schema.user).values({
    id,
    name: phone,
    email: `${phone}@amana.whatsapp`,
    emailVerified: false,
    image: null,
    createdAt: now,
    updatedAt: now,
  });
  return { id, created: true };
}

/**
 * POST /api/requests/create { requesterPhone, recipientPhone, amountMinor, currency, sendNgn? }
 * Bot-guarded. Enforces recipient privacy (open/contacts/blocked) +
 * blocklist + contacts (prior completed transfer either direction).
 * Returns allowed:false with a safe reason (never reveals blocks).
 */
export async function POST(request: Request) {
  if (unauthorized(request)) {
    return Response.json({ ok: false, error: "Unauthorized." }, { status: 401 });
  }
  let body: {
    requesterPhone?: unknown;
    recipientPhone?: unknown;
    amountMinor?: unknown;
    currency?: unknown;
    sendNgn?: unknown;
  };
  try {
    body = await request.json();
  } catch {
    return Response.json(
      { ok: false, error: "Request body must be JSON." },
      { status: 400 },
    );
  }
  const requesterPhone =
    typeof body.requesterPhone === "string"
      ? body.requesterPhone.replace(/\D/g, "")
      : "";
  const recipientPhone =
    typeof body.recipientPhone === "string"
      ? body.recipientPhone.replace(/\D/g, "")
      : "";
  const amountMinor =
    typeof body.amountMinor === "number" ? Math.round(body.amountMinor) : NaN;
  const currency =
    body.currency === "SOL" || body.currency === "USDC" ? body.currency : null;
  if (
    !PHONE_RE.test(requesterPhone) ||
    !PHONE_RE.test(recipientPhone) ||
    requesterPhone === recipientPhone ||
    !Number.isFinite(amountMinor) ||
    amountMinor <= 0 ||
    !currency
  ) {
    return Response.json({ ok: false, error: "Bad request." }, { status: 400 });
  }

  const { db } = getDb();
  const now = new Date();
  const requester = await findOrProvision(db, requesterPhone, now);
  const recipient = await findOrProvision(db, recipientPhone, now);

  // Requester must be verified (bot gates too — defense in depth).
  const profile = await db.query.kycProfile.findFirst({
    where: (k, { eq }) => eq(k.userId, requester.id),
  });
  if (profile?.status !== "verified") {
    return Response.json(
      { ok: false, allowed: false, error: "Requester unverified." },
      { status: 403 },
    );
  }

  // Blocklist (silent — never confirm a block exists).
  const blocked = await db.query.requestBlock.findFirst({
    where: (b, { eq, and }) =>
      and(
        eq(b.blockerUserId, recipient.id),
        eq(b.blockedPhone, requesterPhone),
      ),
  });
  const person = await db.query.user.findFirst({
    where: (u, { eq }) => eq(u.id, recipient.id),
    columns: { requestPrivacy: true },
  });
  const privacy = person?.requestPrivacy ?? "contacts";
  if (blocked || privacy === "blocked") {
    return Response.json(
      { ok: false, allowed: false, error: "Recipient unavailable." },
      { status: 200 },
    );
  }

  // Contacts = prior completed transfer either direction.
  const prior = await db.query.transfer.findFirst({
    where: (t, { eq, and, or }) =>
      or(
        and(
          eq(t.senderUserId, requester.id),
          eq(t.recipientUserId, recipient.id),
        ),
        and(
          eq(t.senderUserId, recipient.id),
          eq(t.recipientUserId, requester.id),
        ),
      ),
  });
  const contactKnown = !!prior;
  if (privacy === "contacts" && !contactKnown) {
    return Response.json(
      { ok: false, allowed: false, error: "Recipient unavailable." },
      { status: 200 },
    );
  }

  const id = crypto.randomUUID();
  await db.insert(schema.moneyRequest).values({
    id,
    requesterUserId: requester.id,
    requesterPhone,
    recipientUserId: recipient.id,
    recipientPhone,
    amountMinor,
    currency,
    sendNgn:
      typeof body.sendNgn === "number" && body.sendNgn > 0
        ? Math.round(body.sendNgn)
        : null,
    status: "pending",
    createdAt: now,
    updatedAt: now,
  });
  return Response.json({ ok: true, allowed: true, id, contactKnown });
}
