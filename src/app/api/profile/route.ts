import { eq } from "drizzle-orm";
import * as schema from "@/db/schema";
import { getAuthInstance } from "@/lib/auth";
import { getDb } from "@/lib/db";

const NAME_RE = /^[A-Za-z][A-Za-z'’\- ]*$/;

/**
 * GET /api/profile — name, contact email, default currency.
 * PATCH /api/profile { fullName?, contactEmail?, defaultCurrency? }.
 * fullName mirrors to kyc_profile (single source for the bot greeting).
 */
export async function GET(request: Request) {
  const auth = await getAuthInstance();
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) {
    return Response.json({ ok: false, error: "Unauthorized." }, { status: 401 });
  }
  const { db } = getDb();
  const person = await db.query.user.findFirst({
    where: (u, { eq }) => eq(u.id, session.user.id),
    columns: { name: true, contactEmail: true, defaultCurrency: true },
  });
  if (!person) {
    return Response.json({ ok: false, error: "Unauthorized." }, { status: 401 });
  }
  return Response.json({ ok: true, profile: person });
}

export async function PATCH(request: Request) {
  const auth = await getAuthInstance();
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) {
    return Response.json({ ok: false, error: "Unauthorized." }, { status: 401 });
  }
  let body: { fullName?: unknown; contactEmail?: unknown; defaultCurrency?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false, error: "Bad JSON." }, { status: 400 });
  }
  const patch: Partial<{ name: string; contactEmail: string | null; defaultCurrency: string }> = {};
  if (body.fullName !== undefined) {
    const name =
      typeof body.fullName === "string"
        ? body.fullName.trim().replace(/\s+/g, " ")
        : "";
    if (name.length < 2 || name.length > 80 || !NAME_RE.test(name)) {
      return Response.json({ ok: false, error: "Full name: letters, 2–80 chars." }, { status: 400 });
    }
    patch.name = name;
  }
  if (body.contactEmail !== undefined) {
    const email = typeof body.contactEmail === "string" ? body.contactEmail.trim() : "";
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return Response.json({ ok: false, error: "Contact email looks invalid." }, { status: 400 });
    }
    patch.contactEmail = email || null;
  }
  if (body.defaultCurrency !== undefined) {
    if (body.defaultCurrency !== "SOL" && body.defaultCurrency !== "USDC" && body.defaultCurrency !== "NGN") {
      return Response.json({ ok: false, error: "Currency must be SOL, USDC, or NGN." }, { status: 400 });
    }
    patch.defaultCurrency = body.defaultCurrency;
  }
  if (Object.keys(patch).length === 0) {
    return Response.json({ ok: false, error: "Nothing to update." }, { status: 400 });
  }
  const { db } = getDb();
  await db
    .update(schema.user)
    .set({ ...patch, updatedAt: new Date() })
    .where(eq(schema.user.id, session.user.id));
  if (patch.name) {
    await db
      .update(schema.kycProfile)
      .set({ fullName: patch.name, updatedAt: new Date() })
      .where(eq(schema.kycProfile.userId, session.user.id));
  }
  return Response.json({ ok: true });
}
