"use client";

import { useEffect, useState } from "react";

/** Chat-first onboarding: the account is born in WhatsApp. */
const WA_LINK = "https://wa.me/2348088848220";

type State = "loading" | "signed-out" | "unverified" | "verified";

const TONES = {
  hero: "hero-cta rounded-[28px] bg-ember-glow px-5 py-2 text-[16px] font-medium text-espresso transition-colors hover:bg-pure-white",
  card: "mt-8 inline-block rounded-[28px] bg-ember-glow px-5 py-2 text-[16px] font-medium text-espresso transition-colors hover:bg-pure-white",
  nav: "rounded-[28px] bg-ember-glow px-5 py-2 text-[14px] font-medium text-espresso transition-colors hover:bg-pure-white",
} as const;

/**
 * Session-aware primary CTA (chat-first model):
 * - signed out → opens the bot chat (account is created there)
 * - signed in, unverified → continues to KYC
 * - verified → opens the dashboard
 * Renders the chat link by default (no layout flash while checking).
 */
export default function GetStartedCta({
  tone = "hero",
  chatLabel = "Start in WhatsApp",
}: {
  tone?: keyof typeof TONES;
  chatLabel?: string;
}) {
  const [state, setState] = useState<State>("loading");

  useEffect(() => {
    let live = true;
    fetch("/api/kyc/status")
      .then((res) => {
        if (!live) return;
        if (!res.ok) {
          setState("signed-out");
          return;
        }
        return res.json().then((data: unknown) => {
          if (!live) return;
          setState(
            (data as { status?: string })?.status === "verified"
              ? "verified"
              : "unverified",
          );
        });
      })
      .catch(() => {
        if (live) setState("signed-out");
      });
    return () => {
      live = false;
    };
  }, []);

  if (state === "verified") {
    return (
      <a href="/dashboard" className={TONES[tone]}>
        Open dashboard
      </a>
    );
  }
  if (state === "unverified") {
    return (
      <a href="/kyc" className={TONES[tone]}>
        Continue verification
      </a>
    );
  }
  return (
    <a
      href={WA_LINK}
      target="_blank"
      rel="noopener noreferrer"
      className={TONES[tone]}
    >
      {chatLabel}
    </a>
  );
}
