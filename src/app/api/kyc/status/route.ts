import { getAuthInstance } from "@/lib/auth";
import { envString, getDb } from "@/lib/db";

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
    if (!secret || botSecret !== secret) {
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
      return Response.json({ ok: true, status: "unknown", verified: false });
    }
    const profile = await db.query.kycProfile.findFirst({
      where: (k, { eq }) => eq(k.userId, person.id),
    });
    const status = profile?.status ?? "pending";
    return Response.json({
      ok: true,
      status,
      verified: status === "verified",
      mocked: profile?.mocked ?? true,
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
      bvn: null,
      nin: null,
    });
  }

  return Response.json({
    ok: true,
    status: profile.status,
    mocked: profile.mocked,
    bvn: profile.bvn,
    nin: profile.nin,
    updatedAt: profile.updatedAt,
  });
}
