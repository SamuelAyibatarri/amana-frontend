/**
 * Transaction PIN helpers (demo grade).
 *
 * SHA-256 over `pin:userId`, hex-encoded, via Web Crypto (Workers-safe).
 * Production wants a proper KDF (argon2/bcrypt) + HSM-backed secrets;
 * this keeps PINs out of plaintext without native modules.
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

export async function hashPin(pin: string, userId: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(`${pin}:${userId}`),
  );
  return hex(digest);
}

export async function checkPin(
  pin: string,
  userId: string,
  pinHash: string,
): Promise<boolean> {
  const candidate = await hashPin(pin, userId);
  return candidate === pinHash;
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
