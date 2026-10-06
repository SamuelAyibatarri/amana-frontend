import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { magicLink } from "better-auth/plugins";
import * as schema from "@/db/schema";
import { envString, getDb } from "@/lib/db";

/**
 * Better Auth instance bound to Cloudflare D1 (`amana_db`).
 * Mirrors the proven `bizzo-admin/src/lib/auth.ts` architecture:
 * per-request instance via `getCloudflareContext()` + `drizzle(env.amana_db)`
 * + `drizzleAdapter(db, { provider: "sqlite", schema })`.
 *
 * WhatsApp entry uses the framework's `magicLink` plugin: the user enters
 * their WhatsApp number on /signin, the framework generates the link, and
 * `sendMagicLink` delivers it to their WhatsApp via the Azure relay
 * (WhatsApp replaces email as the delivery channel). No email/password,
 * no hand-rolled session code.
 */
export async function getAuthInstance() {
  const { db, env } = getDb();

  const baseURL =
    envString("BETTER_AUTH_URL") || "http://localhost:8787";
  const secret = envString("BETTER_AUTH_SECRET");
  const staticOrigins = [
    "http://localhost:8787",
    "http://localhost:3000",
    ...(envString("BETTER_AUTH_URL") ? [envString("BETTER_AUTH_URL")] : []),
    ...(envString("FRONTEND_URL") ? [envString("FRONTEND_URL")] : []),
  ];

  /**
   * Dynamic origin trust: preview tunnels and deploys change hostnames
   * (ayiba.dev, workers.dev, localhost). Trust the request's own origin
   * only when its host is allowlisted — never open-trust.
   */
  const trustedOrigins = async (request?: Request): Promise<string[]> => {
    const origins = [...staticOrigins];
    if (!request) return origins;
    try {
      const origin = request.headers.get("origin");
      if (!origin) return origins;
      const host = new URL(origin).hostname;
      const allowed =
        host === "localhost" ||
        host === "127.0.0.1" ||
        host.endsWith(".ayiba.dev") ||
        host.endsWith(".workers.dev");
      if (allowed && !origins.includes(origin)) origins.push(origin);
    } catch {
      // Malformed origin header — fall back to the static list.
    }
    return origins;
  };

  if (!secret) {
    console.warn(
      "[auth] BETTER_AUTH_SECRET is missing; set it via `wrangler secret put BETTER_AUTH_SECRET`.",
    );
  }

  void env;

  const auth = betterAuth({
    baseURL,
    secret: secret || undefined,
    trustedOrigins,
    database: drizzleAdapter(db, {
      provider: "sqlite",
      schema,
    }),
    plugins: [
      magicLink({
        expiresIn: 900, // 15 minutes, matches the WhatsApp message copy
        sendMagicLink: async ({ email, url }) => {
          // Only phone-derived identities are deliverable over WhatsApp.
          const suffix = "@amana.whatsapp";
          if (!email.endsWith(suffix)) {
            throw new Error(
              "Magic links are delivered to WhatsApp numbers only.",
            );
          }
          const phone = email.slice(0, -suffix.length);
          const relay = envString("AZURE_BACKEND_URL");
          // Single shared secret (must equal the backend's SHARED_SECRET).
          const relaySecret = envString("SHARED_SECRET");
          if (!relay || !relaySecret) {
            throw new Error("WhatsApp relay is not configured.");
          }
          const res = await fetch(
            `${relay.replace(/\/$/, "")}/whatsapp/send`,
            {
              method: "POST",
              headers: {
                "content-type": "application/json",
                "x-amana-secret": relaySecret,
              },
              body: JSON.stringify({
                to: phone,
                text:
                  `*Your Amana sign-in link:*\n\n${url}\n\n` +
                  `_Tap to sign in — expires in 15 minutes._`,
              }),
              signal: AbortSignal.timeout(10_000),
            },
          );
          if (!res.ok) {
            throw new Error("WhatsApp delivery failed.");
          }
        },
      }),
    ],
    session: {
      expiresIn: 60 * 60 * 24, // 24h, matches WhatsApp wallet usage
      updateAge: 60 * 60 * 12,
    },
    advanced: {
      ipAddress: {
        ipAddressHeaders: ["cf-connecting-ip"],
      },
    },
  });

  return auth;
}
