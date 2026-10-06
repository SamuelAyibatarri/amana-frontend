import { envString } from "@/lib/db";
import { signaturesEqual } from "@/lib/webhook";

/**
 * Transaction PIN helpers.
 *
 * PBKDF2-SHA256 (100k iterations — the Cloudflare Workers runtime cap;
 * Node/Bun allow more, workerd throws above 100k) with per-user salt +
 * server pepper (`PIN_PEPPER`), hex-encoded, via Web Crypto
 * (Workers-safe). Stored hashes carry a `v2$` prefix so the KDF can
 * rotate later. Legacy unprefixed/v1 hashes are rejected — users re-set.
 */

export const PIN_RE = /^\d{4}$/;
export const PIN_MAX_ATTEMPTS = 5;
export const PIN_LOCK_MS = 15 * 60 * 1_000;

export const OTP_RE = /^\d{6}$/;
export const OTP_MAX_ATTEMPTS = 5;
export const OTP_TTL_MS = 10 * 60 * 1_000;

function hex(bytes: ArrayBuffer): string {
  return [...new Uint8Array(bytes)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Workers cap PBKDF2 at 100k iterations — stay at the cap, never above. */
export const PBKDF2_ITERATIONS = 100_000;
export const PIN_HASH_VERSION = "v2";

function pepper(): string {
  const p = envString("PIN_PEPPER");
  if (!p) throw new Error("PIN_PEPPER missing");
  return p;
}

export async function hashPin(pin: string, userId: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(`${pepper()}:${pin}`),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      hash: "SHA-256",
      salt: new TextEncoder().encode(`amana-pin:${userId}`),
      iterations: PBKDF2_ITERATIONS,
    },
    key,
    256,
  );
  return `${PIN_HASH_VERSION}$${hex(bits)}`;
}

export async function checkPin(
  pin: string,
  userId: string,
  pinHash: string,
): Promise<boolean> {
  if (!pinHash.startsWith(`${PIN_HASH_VERSION}$`)) return false;
  const candidate = await hashPin(pin, userId);
  return signaturesEqual(candidate, pinHash);
}

/** 6-digit reset OTP, crypto-random. */
export function makeOtp(): string {
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  return String(10_0000 + (buf[0]! % 9_00_000));
}

export async function hashOtp(otp: string, userId: string): Promise<string> {
  return hashPin(`otp:${otp}`, userId);
}
