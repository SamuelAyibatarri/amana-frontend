"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

type LoadState = "checking" | "signed-out" | "ready";
type SubmitState = "idle" | "submitting" | "verified" | "failed";

const ELEVEN_DIGITS = /^\d{11}$/;

export default function KycForm() {
  const router = useRouter();  const [load, setLoad] = useState<LoadState>("checking");
  const [current, setCurrent] = useState<{ bvn: string | null; nin: string | null }>({
    bvn: null,
    nin: null,
  });
  const [bvn, setBvn] = useState("");
  const [nin, setNin] = useState("");
  const [fullName, setFullName] = useState("");
  const [errors, setErrors] = useState<{ bvn?: string; nin?: string; fullName?: string; form?: string }>({});
  const [submit, setSubmit] = useState<SubmitState>("idle");
  const [reason, setReason] = useState("");
  const bvnRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/kyc/status")
      .then((res) => {
        if (cancelled) return;
        if (res.status === 401) {
          setLoad("signed-out");
          return;
        }
        return res.json().then((data: unknown) => {
          if (cancelled) return;
          const status = data as {
            status?: string;
            bvn?: string | null;
            nin?: string | null;
            fullName?: string | null;
          };
          setCurrent({ bvn: status.bvn ?? null, nin: status.nin ?? null });
          if (status.status === "verified") {
            setSubmit("verified");
            setBvn(status.bvn ?? "");
            setNin(status.nin ?? "");
            setFullName(status.fullName ?? "");
          }
          setLoad("ready");
        });
      })
      .catch(() => {
        if (!cancelled) setLoad("signed-out");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (load === "checking") {
    return (
      <p className="text-[16px]" role="status" aria-live="polite">
        Checking your sign-in…
      </p>
    );
  }

  if (load === "signed-out") {
    return (
      <div role="status">
        <p className="text-[20px] leading-[1.43] font-semibold tracking-[-0.015em]">
          Sign in first
        </p>
        <p className="mt-2 max-w-[52ch] text-[14px] leading-[1.5]">
          Verification needs you signed in. Get a fresh sign-in link below —
          no WhatsApp round-trip needed.
        </p>
        <a
          href="/signin"
          className="mt-6 inline-block rounded-[28px] bg-ember-glow px-5 py-2 text-[14px] font-medium text-espresso transition-colors hover:bg-bark hover:text-pure-white"
        >
          Sign in
        </a>
      </div>
    );
  }

  if (submit === "verified") {
    return (
      <div role="status" aria-live="polite">
        <span className="inline-block rounded-[20px] bg-ember-wash px-3 py-1 text-[12px] font-medium text-bark">
          Verified
        </span>
        <p className="mt-4 text-[24px] leading-[1.33] font-semibold tracking-[-0.015em]">
          You’re cleared.
        </p>
        <p className="mt-2 max-w-[52ch] text-[14px] leading-[1.5]">
          Your transfer limits are unlocked. Head back to WhatsApp — try
          “send 0.5 sol” or “buy 200 usdc”.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <a
            href="/dashboard"
            className="inline-block rounded-[28px] bg-ember-glow px-5 py-2 text-[14px] font-medium text-espresso transition-colors hover:bg-bark hover:text-pure-white"
          >
            Open dashboard
          </a>
          <button
            type="button"
            onClick={() => {
              setSubmit("idle");
              setErrors({});
            }}
            className="rounded-[28px] border border-espresso px-5 py-2 text-[14px] font-medium transition-colors hover:bg-espresso hover:text-pure-white"
          >
            Verify different details
          </button>
        </div>
      </div>
    );
  }

  const digitsOnly = (v: string) => v.replace(/\D/g, "").slice(0, 11);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const nextErrors: typeof errors = {};
    const name = fullName.trim().replace(/\s+/g, " ");
    if (name.length < 2 || name.length > 80 || !/^[A-Za-z][A-Za-z'’\- ]*$/.test(name)) {
      nextErrors.fullName = "Enter your full name (letters, 2–80 chars).";
    }
    if (!ELEVEN_DIGITS.test(bvn.trim())) {
      nextErrors.bvn = "BVN must be exactly 11 digits.";
    }
    if (!ELEVEN_DIGITS.test(nin.trim())) {
      nextErrors.nin = "NIN must be exactly 11 digits.";
    }
    setErrors(nextErrors);
    if (nextErrors.fullName || nextErrors.bvn || nextErrors.nin) {
      const target = nextErrors.fullName
        ? document.getElementById("name-input")
        : nextErrors.bvn
          ? bvnRef.current
          : document.getElementById("nin-input");
      target?.focus();
      return;
    }
    setSubmit("submitting");
    try {
      const res = await fetch("/api/kyc/verify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ bvn: bvn.trim(), nin: nin.trim(), fullName: name }),
      });
      const data = (await res.json()) as { status?: string; reason?: string };
      if (res.ok && data.status === "verified") {
        // Freshly verified — the dashboard is the next screen, not a panel.
        router.replace("/dashboard");
        return;
      } else {
        setSubmit("failed");
        setReason(data.reason ?? "Verification failed. Check the numbers and retry.");
      }
    } catch {
      setSubmit("failed");
      setReason("Network hiccup — check your connection and retry.");
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate aria-describedby="kyc-mock-note">
      {submit === "failed" && (
        <p
          role="alert"
          className="mb-6 rounded-[16px] border border-deep-ember bg-ember-wash p-4 text-[14px] font-medium text-bark"
        >
          {reason}
        </p>
      )}
      <div className="flex flex-col gap-6">
        <div>
          <label htmlFor="name-input" className="text-[14px] font-semibold">
            Full name
          </label>
          <input
            id="name-input"
            name="fullName"
            type="text"
            autoComplete="name"
            spellCheck={false}
            placeholder="e.g. Adaeze Okafor…"
            maxLength={80}
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            aria-invalid={!!errors.fullName}
            aria-describedby={errors.fullName ? "name-error" : undefined}
            className="mt-2 w-full rounded-[24px] border border-espresso bg-pure-white px-4 py-3 text-[16px] tracking-[-0.01em] placeholder:text-taupe focus:border-deep-ember focus:outline-none"
          />
          {errors.fullName ? (
            <p id="name-error" role="alert" className="mt-2 text-[14px] font-medium text-deep-ember">
              {errors.fullName}
            </p>
          ) : (
            <p className="mt-2 text-[12px] text-taupe">The bot greets you by this name.</p>
          )}
        </div>
        <div>
          <label htmlFor="bvn-input" className="text-[14px] font-semibold">
            Bank Verification Number
          </label>
          <input
            ref={bvnRef}
            id="bvn-input"
            name="bvn"
            type="text"
            inputMode="numeric"
            autoComplete="off"
            spellCheck={false}
            placeholder="e.g. 12345678901…"
            maxLength={11}
            value={bvn}
            onChange={(e) => setBvn(digitsOnly(e.target.value))}
            aria-invalid={!!errors.bvn}
            aria-describedby={errors.bvn ? "bvn-error" : undefined}
            className="mt-2 w-full rounded-[24px] border border-espresso bg-pure-white px-4 py-3 text-[16px] tracking-[-0.01em] placeholder:text-taupe focus:border-deep-ember focus:outline-none"
          />
          {errors.bvn ? (
            <p id="bvn-error" role="alert" className="mt-2 text-[14px] font-medium text-deep-ember">
              {errors.bvn}
            </p>
          ) : (
            <p className="mt-2 text-[12px] text-taupe">11 digits, numbers only.</p>
          )}
        </div>
        <div>
          <label htmlFor="nin-input" className="text-[14px] font-semibold">
            National Identification Number
          </label>
          <input
            id="nin-input"
            name="nin"
            type="text"
            inputMode="numeric"
            autoComplete="off"
            spellCheck={false}
            placeholder="e.g. 98765432109…"
            maxLength={11}
            value={nin}
            onChange={(e) => setNin(digitsOnly(e.target.value))}
            aria-invalid={!!errors.nin}
            aria-describedby={errors.nin ? "nin-error" : undefined}
            className="mt-2 w-full rounded-[24px] border border-espresso bg-pure-white px-4 py-3 text-[16px] tracking-[-0.01em] placeholder:text-taupe focus:border-deep-ember focus:outline-none"
          />
          {errors.nin ? (
            <p id="nin-error" role="alert" className="mt-2 text-[14px] font-medium text-deep-ember">
              {errors.nin}
            </p>
          ) : (
            <p className="mt-2 text-[12px] text-taupe">11 digits, numbers only.</p>
          )}
        </div>
      </div>
      {current.bvn && (
        <p className="mt-4 text-[12px] text-taupe">
          Last submitted: BVN ••••{current.bvn.slice(-4)}
          {current.nin ? `, NIN ••••${current.nin.slice(-4)}` : ""}. Submitting
          again replaces it.
        </p>
      )}
      <button
        type="submit"
        disabled={submit === "submitting"}
        className="mt-8 w-full rounded-[28px] bg-ember-glow px-5 py-3 text-[16px] font-medium text-espresso transition-colors hover:bg-bark hover:text-pure-white disabled:opacity-60 sm:w-auto"
      >
        {submit === "submitting" ? "Verifying…" : "Verify identity"}
      </button>
      <p id="kyc-mock-note" className="mt-4 text-[12px] leading-[1.5] text-taupe">
        Any 11-digit pair is approved instantly. Nothing leaves this page.
      </p>
    </form>
  );
}
