import { envString } from "@/lib/db";

const PHONE_SUFFIX = "@amana.whatsapp";

/** Phone digits from a phone-derived session email, or null. */
export function phoneFromEmail(email: string): string | null {
  if (!email.endsWith(PHONE_SUFFIX)) return null;
  const digits = email.slice(0, -PHONE_SUFFIX.length).replace(/\D/g, "");
  return digits.length >= 7 && digits.length <= 15 ? digits : null;
}

/**
 * Out-of-band WhatsApp notice via the Azure relay. Best-effort:
 * returns false when unconfigured or undeliverable — callers decide.
 */
export async function sendWhatsApp(
  phone: string,
  text: string,
): Promise<boolean> {
  const relay = envString("AZURE_BACKEND_URL");
  const secret = envString("SHARED_SECRET");
  if (!relay || !secret) return false;
  try {
    const res = await fetch(`${relay.replace(/\/$/, "")}/whatsapp/send`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-amana-secret": secret,
      },
      body: JSON.stringify({ to: phone, text }),
      signal: AbortSignal.timeout(10_000),
    });
    return res.ok;
  } catch {
    return false;
  }
}
