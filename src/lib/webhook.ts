/**
 * HMAC-SHA256 webhook signing (Web Crypto — Workers compatible).
 * The Azure backend verifies this signature before updating the user's
 * transaction clearance status in PostgreSQL (AGENTS.md security rule).
 */

function toHex(buffer: ArrayBuffer): string {
  return [...new Uint8Array(buffer)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Hex HMAC-SHA256 of `body` under `secret`. */
export async function signWebhookBody(
  body: string,
  secret: string,
): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(body),
  );
  return toHex(sig);
}

/** Constant-time-ish comparison of hex digests. */
export function signaturesEqual(a: string, b: string): boolean {
  if (a.length !== b.length || a.length === 0) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

export interface KycWebhookPayload {
  userId: string;
  phone?: string;
  status: "verified" | "failed" | "pending";
  bvnLast4: string;
  ninLast4: string;
  mocked: true;
  verifiedAt: string;
}

export async function sendKycWebhook(args: {
  url: string;
  secret: string;
  payload: KycWebhookPayload;
}): Promise<{ ok: boolean; status: number }> {
  const body = JSON.stringify(args.payload);
  const signature = await signWebhookBody(body, args.secret);
  const res = await fetch(args.url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-amana-signature": signature,
      "x-amana-timestamp": args.payload.verifiedAt,
    },
    body,
  });
  return { ok: res.ok, status: res.status };
}
