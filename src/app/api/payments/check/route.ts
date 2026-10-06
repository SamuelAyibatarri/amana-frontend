import { desc, eq } from "drizzle-orm";
import * as schema from "@/db/schema";
import { getAuthInstance } from "@/lib/auth";
import { envString, getDb } from "@/lib/db";
import { delegateSettle } from "@/lib/settle";
import { signaturesEqual } from "@/lib/webhook";

/**
 * POST /api/payments/check { phone? } — manual "I've paid" verification.
 * Two callers, one funnel:
 * - Bot (x-amana-secret + phone): chat paid-claims.
 * - Web (session cookie, phone optional): dashboard Verify button.
 * Finds the user's latest pending payment, verifies it against Paystack
 * (source of truth — webhooks are only notifications), marks completed,
 * and settles through the same funnel.
 */
export async function POST(request: Request) {
  const botSecret = request.headers.get("x-amana-secret") ?? "";
  const isBotCall = !!envString("SHARED_SECRET") && signaturesEqual(botSecret, envString("SHARED_SECRET"));
  let sessionUserId: string | null = null;
  if (!isBotCall) {
    const auth = await getAuthInstance();
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session) {
      return Response.json({ ok: false, error: "Unauthorized." }, { status: 401 });
    }
    sessionUserId = session.user.id;
  }
  const secretKey = envString("PAYSTACK_SECRET_KEY");
  if (!secretKey) {
    return Response.json({ ok: false, error: "Payments not configured." }, { status: 500 });
  }
  let body: { phone?: unknown };
  try {
    body = (await request.json()) as { phone?: unknown };
  } catch {
    body = {};
  }
  const { db } = getDb();
  let person: { id: string } | undefined;
  if (sessionUserId) {
    person = await db.query.user.findFirst({
      where: (u, { eq }) => eq(u.id, sessionUserId as string),
      columns: { id: true },
    });
  } else {
    const phone =
      typeof body.phone === "string" ? body.phone.replace(/\D/g, "") : "";
    if (!phone) {
      return Response.json({ ok: false, error: "Bad phone." }, { status: 400 });
    }
    person = await db.query.user.findFirst({
      where: (u, { eq }) => eq(u.email, `${phone}@amana.whatsapp`),
      columns: { id: true },
    });
  }
  if (!person) {
    return Response.json({ ok: true, settled: false, reason: "no-user" });
  }
  const pending = await db.query.payment.findFirst({
    where: (p, { and }) =>
      and(eq(p.userId, person.id), eq(p.status, "pending")),
    orderBy: (p, { desc }) => [desc(p.createdAt)],
  });
  if (!pending) {
    return Response.json({ ok: true, settled: false, reason: "no-pending" });
  }
  let verify: { status: boolean; data?: { status?: string } };
  try {
    const res = await fetch(
      `https://api.paystack.co/transaction/verify/${pending.reference}`,
      {
        headers: { Authorization: `Bearer ${secretKey}` },
        signal: AbortSignal.timeout(15_000),
      },
    );
    verify = (await res.json()) as typeof verify;
  } catch {
    return Response.json({ ok: true, settled: false, reason: "verify-unreachable" });
  }
  if (!verify.status || verify.data?.status !== "success") {
    return Response.json({
      ok: true,
      settled: false,
      reason: "not-paid",
      gatewayStatus: verify.data?.status ?? "unknown",
    });
  }
  const now = new Date();
  await db
    .update(schema.payment)
    .set({ status: "completed", paidAt: now, updatedAt: now })
    .where(eq(schema.payment.id, pending.id));
  let meta: unknown = null;
  try {
    meta = pending.metadata ? JSON.parse(pending.metadata) : null;
  } catch {
    meta = null;
  }
  const delegated = await delegateSettle(
    pending.reference,
    { ...((meta ?? {}) as Record<string, unknown>), amountKobo: pending.amount },
  );
  return Response.json({ ok: true, settled: true, delegated });
}
