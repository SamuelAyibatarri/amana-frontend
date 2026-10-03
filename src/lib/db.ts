import { getCloudflareContext } from "@opennextjs/cloudflare";
import { drizzle } from "drizzle-orm/d1";
import * as schema from "@/db/schema";

/**
 * Runtime env accessor that works both on the OpenNext Worker
 * (Cloudflare bindings) and in local `next dev` (process.env).
 */
export function getEnv(): Record<string, unknown> & {
  amana_db?: D1Database;
} {
  try {
    const env = getCloudflareContext().env as unknown as Record<
      string,
      unknown
    > & { amana_db?: D1Database };
    return env;
  } catch {
    // Outside the Workers runtime (e.g. plain `next dev`).
    return (process.env as unknown as Record<string, unknown>) as Record<
      string,
      unknown
    > & { amana_db?: D1Database };
  }
}

export function envString(key: string, fallback = ""): string {
  const env = getEnv();
  const value = env[key] ?? process.env[key];
  return typeof value === "string" && value.length > 0 ? value : fallback;
}

export type AppDb = ReturnType<typeof drizzle<typeof schema>>;

/** Drizzle client bound to the `amana_db` D1 binding. */
export function getDb(): { db: AppDb; env: ReturnType<typeof getEnv> } {
  const env = getEnv();
  if (!env.amana_db) {
    throw new Error(
      "Cloudflare D1 binding 'amana_db' is missing. " +
        "Run via OpenNext/Workers runtime (`bun run preview` or deployed worker), not plain `next dev`.",
    );
  }
  const db = drizzle(env.amana_db, { schema });
  return { db, env };
}
