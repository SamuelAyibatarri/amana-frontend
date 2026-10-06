import { and, eq, gt } from "drizzle-orm";
import * as schema from "@/db/schema";
import { getAuthInstance } from "@/lib/auth";
import { envString, getDb } from "@/lib/db";
import { signaturesEqual } from "@/lib/webhook";

/**
 * POST /api/auth/request-link { phone, callbackURL? } — bot-minted
 * contextual magic links (chat-first onboarding).
 *
 * Bot-secret guarded, never browser-called. Mints a framework magic link
 * for `<phone>@amana.whatsapp` via `auth.api.signInMagicLink`; the
 * existing `sendMagicLink` relay delivers it into the same chat.
 * `callbackURL` is allowlisted to /dashboard and /kyc (no open redirects).
 *
 * Cooldown (12 min) is derived from live `verification` rows
 * (`magic-link:{email}` with >3 min left to live ≈ minted <12 min ago) —
 * zero schema changes. Failed relay delivery cleans up its own row so a
 * delivery hiccup never strands the user behind a cooldown.
 */
const CALLBACKS = ["/dashboard", "/kyc"] as const;
const LINK_TTL_MS = 15 * 60 * 1_000;
const COOLDOWN_MS = 12 * 60 * 1_000;

export async function POST(request: Request) {
  const secret = envString("SHARED_SECRET");
  if (
    !secret ||
    !signaturesEqual(request.headers.get("x-amana-secret") ?? "", secret)
  ) {
    return Response.json({ ok: false, error: "Unauthorized." }, { status: 401 });
  }

  let body: { phone?: unknown; callbackURL?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json(
      { ok: false, error: "Request body must be JSON { phone, callbackURL? }." },
      { status: 400 },
    );
  }

  const phone = typeof body.phone === "string" ? body.phone.replace(/\D/g, "") : "";
  if (phone.length < 7 || phone.length > 15) {
    return Response.json({ ok: false, error: "Bad phone." }, { status: 400 });
  }
  const callbackURL =
    typeof body.callbackURL === "string" &&
    (CALLBACKS as readonly string[]).includes(body.callbackURL)
      ? body.callbackURL
      : "/dashboard";
  const email = `${phone}@amana.whatsapp`;

  const { db } = getDb();
  const identifier = `magic-link:${email}`;
  // Live row with >3 min left ≈ minted within the last 12 of its 15 min.
  const fresh = await db.query.verification.findFirst({
    where: (v, { eq, and, gt }) =>
      and(
        eq(v.identifier, identifier),
        gt(v.expiresAt, new Date(Date.now() + (LINK_TTL_MS - COOLDOWN_MS))),
      ),
  });
  if (fresh) {
    const retryAfter = Math.max(
      1,
      Math.ceil(
        (fresh.expiresAt.getTime() - (LINK_TTL_MS - COOLDOWN_MS) - Date.now()) / 1000,
      ),
    );
    return Response.json(
      { ok: false, error: "Link already sent — check WhatsApp.", retryAfter, cooldown: true },
      { status: 429 },
    );
  }

  const auth = await getAuthInstance();
  try {
    await auth.api.signInMagicLink({
      body: { email, callbackURL },
      headers: new Headers(),
    });
  } catch (err) {
    // Delivery failed — remove our row so no cooldown strands the user.
    try {
      await db
        .delete(schema.verification)
        .where(
          and(
            eq(schema.verification.identifier, identifier),
            gt(schema.verification.expiresAt, new Date()),
          ),
        );
    } catch {
      // Cleanup best-effort; the row expires on its own in 15 min.
    }
    console.error(
      "[auth/request-link] mint failed:",
      err instanceof Error ? err.message : err,
    );
    return Response.json(
      { ok: false, error: "Could not send the link. Retry." },
      { status: 502 },
    );
  }
  return Response.json({ ok: true, sent: true });
}
