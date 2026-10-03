"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

type Status = "idle" | "verifying" | "verified" | "error";

/**
 * Surfaces magic-link outcomes on the landing page: the framework verifies
 * `?token=` links itself (see [...all]) and redirects to the callback URL;
 * direct endpoint hits land here with `?verified=1` / `?error=`.
 */
export default function TokenHandler() {
  const params = useSearchParams();
  const [status, setStatus] = useState<Status>("idle");
  const [detail, setDetail] = useState("");

  useEffect(() => {
    if (params.get("verified") === "1") {
      setStatus("verified");
      return;
    }
    if (params.get("error")) {
      setStatus("error");
      setDetail("That sign-in link was invalid or expired. Get a fresh one from sign-in.");
      return;
    }
  }, [params]);

  if (status === "idle") return null;

  return (
    <div className="on-light mx-auto max-w-[1200px] px-4 pt-8 sm:px-8" role="status" aria-live="polite">
      <div className="rounded-[20px] border border-espresso bg-warm-bone p-6 text-espresso sm:p-8">
        {status === "verifying" && (
          <p className="text-[16px]">Verifying your WhatsApp link…</p>
        )}
        {status === "verified" && (
          <div>
            <span className="inline-block rounded-[20px] bg-ember-wash px-3 py-1 text-[12px] font-medium text-bark">
              Signed in
            </span>
            <p className="mt-4 text-[24px] leading-[1.33] font-semibold tracking-[-0.015em]">
              You’re in.
            </p>
            <p className="mt-2 max-w-[60ch] text-[16px] leading-[1.5]">
              Next step: mock KYC below — any 11-digit BVN + NIN passes.
            </p>
            <a
              href="/kyc"
              className="mt-6 inline-block rounded-[28px] bg-ember-glow px-5 py-2 text-[14px] font-medium text-espresso transition-colors hover:bg-bark hover:text-pure-white"
            >
              Continue to KYC
            </a>
          </div>
        )}
        {status === "error" && (
          <div>
            <p className="text-[24px] leading-[1.33] font-semibold tracking-[-0.015em]">
              Link didn’t work
            </p>
            <p className="mt-2 max-w-[60ch] text-[16px] leading-[1.5]">{detail}</p>
          </div>
        )}
      </div>
    </div>
  );
}
