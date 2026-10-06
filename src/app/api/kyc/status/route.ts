import { getAuthInstance } from "@/lib/auth";
import { envString, getDb } from "@/lib/db";
import { signaturesEqual } from "@/lib/webhook";

const last4 = (v: string | null) =>
  typeof v === "string" && v.length >= 4 ? v.slice(-4) : null;

/**
 * GET /api/kyc/status — current KYC state for the signed-in user.
 * Returns the `kyc_profile` row or a `pending` default when absent.
 *
 * Bot clearance branch: when the `x-amana-secret` header matches
 * `SHARED_SECRET`, the Azure bot may look up verification by WhatsApp
 * phone (`?phone=<digits>`). The bot only ever knows the phone, so the
 * phone-derived Better Auth email (`<phone>@amana.whatsapp`) is derived
 * here. Unknown phone -> `unknown`, never an error the bot could misread
 * as verified.
 */
export async function GET(request: Request) {
  const botSecret = request.headers.get("x-amana-secret");
  if (botSecret) {
    const secret = envString("SHARED_SECRET");
    if (!secret || !signaturesEqual(botSecret, secret)) {
      return Response.json({ ok: false, error: "Unauthorized." }, { status: 401 });
    }
    const url = new URL(request.url);
    const phone = (url.searchParams.get("phone") ?? "").replace(/\D/g, "");
    if (!phone) {
      return Response.json({ ok: false, error: "Missing phone." }, { status: 400 });
    }
    const { db } = getDb();
    const person = await db.query.user.findFirst({
      where: (u, { eq }) => eq(u.email, `${phone}@amana.whatsapp`),
    });
    if (!person) {
      return Response.json({ ok: true, status: "unknown", verified: false, linked: false });
    }
    const profile = await db.query.kycProfile.findFirst({
      where: (k, { eq }) => eq(k.userId, person.id),
    });
    const status = profile?.status ?? "pending";
    return Response.json({
      ok: true,
      status,
      verified: status === "verified",
      linked: true,
      mocked: profile?.mocked ?? true,
      name: person.name,
      defaultCurrency: person.defaultCurrency ?? "NGN",
    });
  }

  const auth = await getAuthInstance();
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) {
    return Response.json({ ok: false, error: "Unauthorized." }, { status: 401 });
  }

  const { db } = getDb();
  const profile = await db.query.kycProfile.findFirst({
    where: (k, { eq }) => eq(k.userId, session.user.id),
  });

  if (!profile) {
    return Response.json({
      ok: true,
      status: "pending",
      mocked: true,
      bvnLast4: null,
      ninLast4: null,
      fullName: null,
    });
  }

  return Response.json({
    ok: true,
    status: profile.status,
    mocked: profile.mocked,
    bvnLast4: last4(profile.bvn),
    ninLast4: last4(profile.nin),
    fullName: profile.fullName,
    updatedAt: profile.updatedAt,
  });
}
