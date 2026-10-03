"use client";

import { useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { authClient } from "@/lib/auth-client";
import PinForm from "@/components/PinForm";

gsap.registerPlugin(useGSAP);

type Load = "checking" | "signed-out" | "ready";

interface Payment {
  reference: string;
  amount: number;
  currency: string;
  status: string;
  channel: string | null;
  paidAt: number | null;
  createdAt: number | null;
}

const naira = (kobo: number) =>
  `₦${(kobo / 100).toLocaleString("en-NG", { maximumFractionDigits: 2 })}`;

const fmtDate = (ms: number | null) =>
  ms
    ? new Date(ms).toLocaleDateString("en-NG", {
        day: "numeric",
        month: "short",
      })
    : "—";

/**
 * Wallet home: balance hero (honest empty state until the engine lands),
 * fund/send actions, live status chips, real transaction history, PIN.
 */
export default function Dashboard({ botNumber }: { botNumber: string }) {
  const root = useRef<HTMLDivElement>(null);
  const [load, setLoad] = useState<Load>("checking");
  const [kyc, setKyc] = useState<string>("pending");
  const [pinSet, setPinSet] = useState(false);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [fundNaira, setFundNaira] = useState("");
  const [fundError, setFundError] = useState("");
  const [funding, setFunding] = useState(false);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        gsap.fromTo(
          ".dash-rise",
          { autoAlpha: 0, y: 24 },
          {
            autoAlpha: 1,
            y: 0,
            duration: 0.6,
            ease: "power2.out",
            stagger: 0.09,
          },
        );
      });
    },
    { scope: root },
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const status = await fetch("/api/kyc/status");
        if (cancelled) return;
        if (status.status === 401) {
          setLoad("signed-out");
          return;
        }
        const s = (await status.json()) as { status?: string };
        if (!cancelled) setKyc(s.status ?? "pending");
      } catch {
        if (!cancelled) {
          setLoad("signed-out");
          return;
        }
      }
      try {
        const [pinRes, payRes] = await Promise.all([
          fetch("/api/pin/status"),
          fetch("/api/payments/mine"),
        ]);
        if (cancelled) return;
        if (pinRes.ok) {
          const p = (await pinRes.json()) as { set?: boolean };
          setPinSet(p.set === true);
        }
        if (payRes.ok) {
          const p = (await payRes.json()) as { payments?: Payment[] };
          setPayments(p.payments ?? []);
        }
      } catch {
        // Non-fatal: cards render empty states.
      }
      if (!cancelled) setLoad("ready");
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function onFund(e: React.FormEvent) {
    e.preventDefault();
    const nairaAmount = Number(fundNaira.replace(/,/g, ""));
    if (!Number.isFinite(nairaAmount) || nairaAmount < 100) {
      setFundError("Minimum funding is ₦100 (Paystack test mode).");
      return;
    }
    setFundError("");
    setFunding(true);
    try {
      const res = await fetch("/api/payments/initialize", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ amountKobo: Math.round(nairaAmount * 100) }),
      });
      const data = (await res.json()) as {
        authorization_url?: string;
        error?: string;
      };
      if (res.ok && data.authorization_url) {
        window.location.href = data.authorization_url;
        return;
      }
      setFundError(data.error ?? "Could not start funding. Retry.");
    } catch {
      setFundError("Network hiccup — check your connection and retry.");
    } finally {
      setFunding(false);
    }
  }

  async function onSignOut() {
    await authClient.signOut();
    window.location.href = "/";
  }

  if (load === "checking") {
    return (
      <p className="text-[16px]" role="status" aria-live="polite">
        Loading your dashboard…
      </p>
    );
  }

  if (load === "signed-out") {
    return (
      <div role="status" className="dash-rise">
        <p className="text-[20px] leading-[1.43] font-semibold tracking-[-0.015em]">
          Sign in first
        </p>
        <p className="mt-2 max-w-[52ch] text-[14px] leading-[1.5]">
          Your dashboard needs you signed in.
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

  const verified = kyc === "verified";
  const chatHref = botNumber
    ? `https://wa.me/${botNumber}?text=${encodeURIComponent("hello")}`
    : "https://wa.me/";

  return (
    <div ref={root}>
      {/* Hero band */}
      <section
        aria-labelledby="dash-hero"
        className="dash-rise relative overflow-hidden rounded-[24px] bg-ember-night px-6 py-10 text-pure-white sm:px-10 sm:py-14"
      >
        <div
          aria-hidden
          className="ember-orb absolute top-[-160px] right-[-120px] h-[380px] w-[380px] opacity-40"
        />
        <div className="relative">
          <p className="font-instrument-serif text-[18px] text-sand italic">
            your money HQ
          </p>
          <h2
            id="dash-hero"
            className="display-section mt-4 max-w-[14ch] text-balance"
          >
            Wallet <span className="text-ember-glow">ready.</span>
          </h2>
          <div
            className="mt-6 flex flex-wrap gap-2"
            role="status"
            aria-live="polite"
            aria-label="Account status"
          >
            <span className="inline-block rounded-[20px] bg-ember-wash px-3 py-1 text-[12px] font-medium text-bark">
              {verified ? "KYC verified" : kyc === "failed" ? "KYC failed" : "KYC pending"}
            </span>
            <span className="inline-block rounded-[20px] border border-sand px-3 py-1 text-[12px] font-medium text-sand">
              {pinSet ? "PIN set" : "No PIN yet"}
            </span>
          </div>
          <div className="mt-8 flex flex-wrap gap-3">
            <a
              href="#dash-fund"
              className="inline-block rounded-[28px] bg-ember-glow px-5 py-2 text-[14px] font-medium text-espresso transition-colors hover:bg-pure-white"
            >
              Fund wallet
            </a>
            <a
              href={chatHref}
              target="_blank"
              rel="noreferrer"
              className="inline-block rounded-[28px] border border-pure-white px-5 py-2 text-[14px] font-medium text-pure-white transition-colors hover:border-ember-glow hover:text-ember-glow"
            >
              Open in WhatsApp
            </a>
          </div>
        </div>
      </section>

      {/* Balance + fund */}
      <section
        id="dash-fund"
        aria-labelledby="dash-balance"
        className="dash-rise mt-6 scroll-mt-8 rounded-[20px] border border-espresso bg-warm-bone p-6 sm:p-8"
      >
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h3
              id="dash-balance"
              className="text-[14px] font-semibold tracking-[0.05em] text-taupe uppercase"
            >
              Balance
            </h3>
            <p className="mt-2 text-[40px] leading-[1.2] font-semibold tracking-[-0.031em]">
              — —
            </p>
            <p className="mt-2 max-w-[52ch] text-[14px] leading-[1.5] text-taupe">
              Live balances arrive with the wallet engine. Funding below lands
              as Paystack test credit meanwhile.
            </p>
          </div>
        </div>
        <form onSubmit={onFund} noValidate className="mt-6">
          {fundError && (
            <p
              role="alert"
              className="mb-4 rounded-[16px] border border-deep-ember bg-ember-wash p-4 text-[14px] font-medium text-bark"
            >
              {fundError}
            </p>
          )}
          <label htmlFor="fund-amount" className="text-[14px] font-semibold">
            Fund with Paystack (test mode)
          </label>
          <div className="mt-2 flex flex-col gap-3 sm:flex-row">
            <input
              id="fund-amount"
              inputMode="decimal"
              placeholder="₦1,000"
              value={fundNaira}
              onChange={(e) =>
                setFundNaira(e.target.value.replace(/[^0-9.,]/g, ""))
              }
              className="w-full rounded-[24px] border border-espresso bg-pure-white px-4 py-3 text-[16px] placeholder:text-taupe focus:border-deep-ember focus:outline-none sm:max-w-[240px]"
            />
            <button
              type="submit"
              disabled={funding}
              className="rounded-[28px] bg-ember-glow px-5 py-3 text-[16px] font-medium text-espresso transition-colors hover:bg-bark hover:text-pure-white disabled:opacity-60"
            >
              {funding ? "Starting…" : "Fund"}
            </button>
          </div>
        </form>
      </section>

      {/* Transactions */}
      <section
        aria-labelledby="dash-tx"
        className="dash-rise mt-6 rounded-[20px] border border-espresso bg-warm-bone p-6 sm:p-8"
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3
            id="dash-tx"
            className="text-[20px] leading-[1.43] font-semibold tracking-[-0.015em]"
          >
            Transactions
          </h3>
          <span className="inline-block rounded-[20px] bg-ember-wash px-3 py-1 text-[12px] font-medium text-bark">
            {payments.length === 0
              ? "Empty"
              : `${payments.length} recent`}
          </span>
        </div>
        {payments.length === 0 ? (
          <p className="mt-4 max-w-[52ch] text-[14px] leading-[1.5]">
            No transactions yet. Your history will appear here after your
            first funding — and in chat after your first buy.
          </p>
        ) : (
          <ul className="mt-4 divide-y divide-espresso/10">
            {payments.map((p) => (
              <li
                key={p.reference}
                className="flex items-center justify-between gap-4 py-3"
              >
                <div className="min-w-0">
                  <p className="truncate text-[14px] font-semibold">
                    {naira(p.amount)}{" "}
                    <span className="font-normal text-taupe">{p.currency}</span>
                  </p>
                  <p className="mt-1 truncate font-mono text-[12px] text-taupe">
                    {p.reference} · {fmtDate(p.paidAt ?? p.createdAt)}
                    {p.channel ? ` · ${p.channel}` : ""}
                  </p>
                </div>
                <span className="shrink-0 rounded-[20px] bg-ember-wash px-3 py-1 text-[12px] font-medium text-bark">
                  {p.status}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Security */}
      <section
        aria-labelledby="dash-pin"
        className="dash-rise mt-6 rounded-[20px] border border-espresso bg-warm-bone p-6 sm:p-8"
      >
        <h3
          id="dash-pin"
          className="text-[20px] leading-[1.43] font-semibold tracking-[-0.015em]"
        >
          Security
        </h3>
        <p className="mt-2 max-w-[52ch] text-[14px] leading-[1.5]">
          4 digits the WhatsApp bot asks for before approving payments. 5
          wrong tries lock approvals for 15 minutes.
        </p>
        <div className="mt-6">
          <PinForm />
        </div>
        <div className="mt-8 border-t border-espresso/10 pt-6">
          <button
            type="button"
            onClick={onSignOut}
            className="rounded-[28px] border border-espresso px-5 py-2 text-[14px] font-medium transition-colors hover:bg-espresso hover:text-pure-white"
          >
            Sign out
          </button>
        </div>
      </section>

      {/* Identity nudge */}
      {!verified && (
        <section
          aria-labelledby="dash-kyc"
          className="dash-rise mt-6 rounded-[20px] border border-deep-ember bg-ember-wash p-6 sm:p-8"
        >
          <h3
            id="dash-kyc"
            className="text-[20px] leading-[1.43] font-semibold tracking-[-0.015em]"
          >
            One step left: identity
          </h3>
          <p className="mt-2 max-w-[52ch] text-[14px] leading-[1.5]">
            Buying and sending unlock after verification. Any 11-digit BVN +
            NIN passes the mock check.
          </p>
          <a
            href="/kyc"
            className="mt-6 inline-block rounded-[28px] bg-ember-glow px-5 py-2 text-[14px] font-medium text-espresso transition-colors hover:bg-bark hover:text-pure-white"
          >
            Verify identity
          </a>
        </section>
      )}
    </div>
  );
}
