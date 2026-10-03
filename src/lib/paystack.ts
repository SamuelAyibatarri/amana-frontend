import { signaturesEqual } from "@/lib/webhook";

/**
 * Paystack webhook primitives (Workers-compatible Web Crypto).
 * Mirrors `bizzo-ride-backend/src/lib/crypto.ts`: Paystack signs the raw
 * request body with HMAC-SHA512 under the secret key.
 */

function toHex(buffer: ArrayBuffer): string {
  return [...new Uint8Array(buffer)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** True when `signature` (x-paystack-signature) matches the raw body. */
export async function verifyPaystackSignature(
  rawBody: string,
  secret: string,
  signature: string,
): Promise<boolean> {
  if (!rawBody || !secret || !signature) return false;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-512" },
    false,
    ["sign"],
  );
  const digest = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(rawBody),
  );
  return signaturesEqual(toHex(digest), signature.trim().toLowerCase());
}

export interface PaystackWebhookEvent {
  event: string;
  data: {
    reference?: string;
    status?: string;
    channel?: string;
    paid_at?: string;
    [key: string]: unknown;
  };
}

/** Map a Paystack charge event to our payment status. Null = ignore. */
export function paystackEventToStatus(
  event: PaystackWebhookEvent,
): "completed" | "failed" | null {
  if (event.event === "charge.success") return "completed";
  if (
    event.event === "charge.failed" ||
    event.event === "charge.dispute" ||
    (event.event.startsWith("charge.") && event.data.status === "failed")
  ) {
    return "failed";
  }
  return null;
}
