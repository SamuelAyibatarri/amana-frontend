import { eq } from "drizzle-orm";
import * as schema from "@/db/schema";
import { getAuthInstance } from "@/lib/auth";
import { envString, getDb } from "@/lib/db";
import { mockVerifyBvnNin } from "@/lib/kyc";
import { sendKycWebhook } from "@/lib/webhook";

const last4 = (v: string) => (v.length >= 4 ? v.slice(-4) : v);

/**
 * POST /api/kyc/verify { bvn, nin }
 *
 * Applies the mocked 11-digit rule, upserts `kyc_profile` in D1, and fires
 * the HMAC-signed webhook to the Azure backend so it can update the user's
 * transaction clearance status in PostgreSQL.
 */
export async function POST(request: Request) {
  const auth = await getAuthInstance();
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) {
    return Response.json({ ok: false, error: "Unauthorized." }, { status: 401 });
  }

  let body: { bvn?: unknown; nin?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json(
      { ok: false, error: "Request body must be JSON { bvn, nin }." },
      { status: 400 },
    );
  }

  const result = mockVerifyBvnNin({ bvn: body.bvn, nin: body.nin });
  if (result.status === "pending") {
    return Response.json(
      { ok: false, error: "BVN and NIN are required." },
      { status: 400 },
    );
  }

  const { db } = getDb();
  const userId = session.user.id;
  const now = new Date();

  const existing = await db.query.kycProfile.findFirst({
    where: (k, { eq }) => eq(k.userId, userId),
  });

  if (existing) {
    await db
      .update(schema.kycProfile)
      .set({
        bvn: result.bvn,
        nin: result.nin,
        status: result.status,
        mocked: true,
        updatedAt: now,
      })
      .where(eq(schema.kycProfile.id, existing.id));
  } else {
    await db.insert(schema.kycProfile).values({
      id: crypto.randomUUID(),
      userId,
      bvn: result.bvn,
      nin: result.nin,
      status: result.status,
      mocked: true,
      createdAt: now,
      updatedAt: now,
    });
  }

  // Notify Azure backend. Best-effort: a webhook failure must not undo D1.
  let webhookOk: boolean | null = null;
  const baseUrl = envString("AZURE_BACKEND_URL");
  const webhookUrl =
    envString("KYC_WEBHOOK_URL") ||
    (baseUrl ? `${baseUrl.replace(/\/$/, "")}/webhooks/kyc` : "");
  const webhookSecret = envString("SHARED_SECRET");

  if (webhookUrl && webhookSecret) {
    try {
      const res = await sendKycWebhook({
        url: webhookUrl,
        secret: webhookSecret,
        payload: {
          userId,
          phone: session.user.email.endsWith("@amana.whatsapp")
            ? session.user.email.replace("@amana.whatsapp", "")
            : undefined,
          status: result.status,
          bvnLast4: last4(result.bvn),
          ninLast4: last4(result.nin),
          mocked: true,
          verifiedAt: now.toISOString(),
        },
      });
      webhookOk = res.ok;
      if (!res.ok) {
        console.error(`[kyc/verify] webhook POST failed: HTTP ${res.status}`);
      }
    } catch (err) {
      webhookOk = false;
      console.error(
        "[kyc/verify] webhook error:",
        err instanceof Error ? err.message : err,
      );
    }
  } else {
    console.warn(
      "[kyc/verify] KYC_WEBHOOK_URL/AZURE_BACKEND_URL or WEBHOOK_SECRET missing; skipping webhook.",
    );
  }

  return Response.json({
    ok: true,
    status: result.status,
    mocked: true,
    reason: result.reason,
    webhookOk,
  });
}
