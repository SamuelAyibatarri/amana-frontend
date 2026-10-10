"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { authClient } from "@/lib/auth-client";
import { Activity, ChevronLeft, ChevronRight, Home, Settings, ShieldCheck, type LucideIcon } from "lucide-react";
import PinForm from "@/components/PinForm";

gsap.registerPlugin(useGSAP);

type Load = "checking" | "signed-out" | "ready";
type Tab = "home" | "activity" | "security" | "settings";

interface Payment {
  kind: "funding";
  reference: string;
  amount: number;
  currency: string;
  status: string;
  channel: string | null;
  paidAt: number | null;
  createdAt: number | null;
}

interface Transfer {
  kind: "transfer";
  direction: "sent" | "received";
  counterparty: string | null;
  amountMinor: number;
  currency: string;
  status: string;
  createdAt: number | null;
}

const DECIMALS: Record<string, number> = { SOL: 9, USDC: 6, NGN: 2 };

const money = (minor: number, currency: string) => {
  const v = minor / 10 ** (DECIMALS[currency] ?? 2);
  const prefix = currency === "NGN" ? "₦" : "";
  return `${prefix}${v.toLocaleString("en-NG", { maximumFractionDigits: 9 })}${currency === "NGN" ? "" : ` ${currency}`}`;
};

const naira = (kobo: number) =>
  `₦${(kobo / 100).toLocaleString("en-NG", { maximumFractionDigits: 2 })}`;

const fmtDate = (ms: number | null) =>
  ms
    ? new Date(ms).toLocaleDateString("en-NG", {
        day: "numeric",
        month: "short",
      })
    : "—";

const TABS: Array<{ id: Tab; label: string; icon: LucideIcon }> = [
  { id: "home", label: "Home", icon: Home },
  { id: "activity", label: "Activity", icon: Activity },
  { id: "security", label: "Security", icon: ShieldCheck },
  { id: "settings", label: "Settings", icon: Settings },
];

/**
 * Wallet dashboard shell: desktop rail (left/right toggle) + mobile
 * bottom bar. Home (live balance, prices, highlights), Activity
 * (filter + CSV export), Security (PIN), Settings (profile, currency).
 */
export default function Dashboard({ botNumber }: { botNumber: string }) {
  const root = useRef<HTMLDivElement>(null);
  const [load, setLoad] = useState<Load>("checking");
  const [tab, setTab] = useState<Tab>("home");
  const [railSide, setRailSide] = useState<"left" | "right">("left");
  const [kyc, setKyc] = useState<string>("pending");
  const [pinSet, setPinSet] = useState(false);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const [balances, setBalances] = useState<Record<string, number> | null>(null);
  const [prices, setPrices] = useState<{ solUsd?: number; usdcUsd?: number; live?: boolean } | null>(null);
  const [mirror, setMirror] = useState<{ allMatch?: boolean } | null>(null);
  const [profile, setProfile] = useState<{ name?: string; contactEmail?: string | null; defaultCurrency?: string } | null>(null);
  const [fundNaira, setFundNaira] = useState("");
  const [fundAsset, setFundAsset] = useState<"SOL" | "USDC">("SOL");
  const [fundError, setFundError] = useState("");
  const [funding, setFunding] = useState(false);
  const [month, setMonth] = useState<string>("all");
  const [saveMsg, setSaveMsg] = useState("");
  const [saving, setSaving] = useState(false);
  const [checking, setChecking] = useState(false);
  const [checkMsg, setCheckMsg] = useState("");

  async function refreshPayments() {
    try {
      const payRes = await fetch("/api/payments/mine");
      if (!payRes.ok) return;
      const p = (await payRes.json()) as {
        payments?: Payment[];
        transfers?: Transfer[];
      };
      setPayments(p.payments ?? []);
      setTransfers(p.transfers ?? []);
    } catch {
      // Non-fatal.
    }
    try {
      const balRes = await fetch("/api/balance/mine");
      if (balRes.ok) {
        const b = (await balRes.json()) as { balances?: Record<string, number> };
        setBalances(b.balances ?? null);
      }
    } catch {
      // Non-fatal.
    }
  }

  async function onCheckPayment() {
    setChecking(true);
    setCheckMsg("");
    try {
      const res = await fetch("/api/payments/check", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        settled?: boolean;
        reason?: string;
      };
      if (data.ok && data.settled) {
        setCheckMsg("Payment confirmed ✓ — balance updated, receipt sent in chat.");
        await refreshPayments();
      } else if (data.reason === "no-pending") {
        setCheckMsg("No pending payment found.");
        await refreshPayments();
      } else {
        setCheckMsg("Not seeing it yet — if you just paid, wait a minute and check again.");
      }
    } catch {
      setCheckMsg("Couldn't reach payments — retry in a minute.");
    } finally {
      setChecking(false);
    }
  }

  const pendingPayments = useMemo(
    () => payments.filter((p) => p.status === "pending"),
    [payments],
  );

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
    try {
      const side = window.localStorage.getItem("amana-rail-side");
      if (side === "left" || side === "right") setRailSide(side);
    } catch {
      // Private mode — default stands.
    }
  }, []);

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
        const [pinRes, payRes, balRes, priceRes, mirrorRes, profRes] =
          await Promise.all([
            fetch("/api/pin/status"),
            fetch("/api/payments/mine"),
            fetch("/api/balance/mine"),
            fetch("/api/prices"),
            fetch("/api/mirror"),
            fetch("/api/profile"),
          ]);
        if (cancelled) return;
        if (pinRes.ok) {
          const p = (await pinRes.json()) as { set?: boolean };
          setPinSet(p.set === true);
        }
        if (payRes.ok) {
          const p = (await payRes.json()) as {
            payments?: Payment[];
            transfers?: Transfer[];
          };
          setPayments(p.payments ?? []);
          setTransfers(p.transfers ?? []);
        }
        if (balRes.ok) {
          const b = (await balRes.json()) as { balances?: Record<string, number> };
          setBalances(b.balances ?? null);
        }
        if (priceRes.ok) {
          const pr = (await priceRes.json()) as {
            solUsd?: number;
            usdcUsd?: number;
            live?: boolean;
          };
          setPrices(pr);
        }
        if (mirrorRes.ok) {
          setMirror((await mirrorRes.json()) as { allMatch?: boolean });
        }
        if (profRes.ok) {
          const pr = (await profRes.json()) as {
            profile?: { name?: string; contactEmail?: string | null; defaultCurrency?: string };
          };
          setProfile(pr.profile ?? null);
          if (pr.profile?.defaultCurrency === "SOL" || pr.profile?.defaultCurrency === "USDC") {
            setFundAsset(pr.profile.defaultCurrency);
          }
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
        body: JSON.stringify({
          amountKobo: Math.round(nairaAmount * 100),
          metadata: { asset: fundAsset },
        }),
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

  function setSide(side: "left" | "right") {
    setRailSide(side);
    try {
      window.localStorage.setItem("amana-rail-side", side);
    } catch {
      // Ignore.
    }
  }

  const months = useMemo(() => {
    const set = new Set<string>();
    for (const p of payments) {
      const ms = p.paidAt ?? p.createdAt;
      if (ms) set.add(new Date(ms).toISOString().slice(0, 7));
    }
    for (const t of transfers) {
      if (t.createdAt) set.add(new Date(t.createdAt).toISOString().slice(0, 7));
    }
    return [...set].sort().reverse();
  }, [payments, transfers]);

  const inMonth = (ms: number | null) =>
    month === "all" || (ms != null && new Date(ms).toISOString().slice(0, 7) === month);

  const highlights = useMemo(() => {
    let inn = 0;
    let out = 0;
    const now = new Date();
    const thisMonth = now.toISOString().slice(0, 7);
    for (const p of payments) {
      const ms = p.paidAt ?? p.createdAt;
      if (p.status !== "completed" || !ms) continue;
      if (new Date(ms).toISOString().slice(0, 7) !== thisMonth) continue;
      inn += p.amount / 100;
    }
    for (const t of transfers) {
      if (!t.createdAt) continue;
      if (new Date(t.createdAt).toISOString().slice(0, 7) !== thisMonth) continue;
      const v = t.amountMinor / 10 ** (DECIMALS[t.currency] ?? 2);
      if (t.direction === "received") inn += 0; // crypto legs stay native
      else out += v;
    }
    return { inn, out };
  }, [payments, transfers]);

  function exportCsv() {
    const rows: string[] = ["date,type,detail,amount,currency,status"];
    for (const p of payments) {
      const ms = p.paidAt ?? p.createdAt;
      if (!inMonth(ms)) continue;
      rows.push(
        [ms ? new Date(ms).toISOString() : "", "funding", p.reference, p.amount / 100, "NGN", p.status]
          .map((v) => `"${String(v).replace(/"/g, '""')}"`)
          .join(","),
      );
    }
    for (const t of transfers) {
      if (!inMonth(t.createdAt)) continue;
      rows.push(
        [
          t.createdAt ? new Date(t.createdAt).toISOString() : "",
          `transfer-${t.direction}`,
          t.counterparty ?? "",
          t.amountMinor / 10 ** (DECIMALS[t.currency] ?? 2),
          t.currency,
          t.status,
        ]
          .map((v) => `"${String(v).replace(/"/g, '""')}"`)
          .join(","),
      );
    }
    const blob = new Blob([rows.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `amana-${month === "all" ? "all" : month}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function onSaveProfile(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setSaving(true);
    setSaveMsg("");
    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          fullName: form.get("fullName"),
          contactEmail: form.get("contactEmail"),
          defaultCurrency: form.get("defaultCurrency"),
        }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      setSaveMsg(res.ok && data.ok ? "Saved ✓" : (data.error ?? "Save failed."));
      if (res.ok) {
        const pr = await fetch("/api/profile").then((r) => r.json()) as {
          profile?: { name?: string; contactEmail?: string | null; defaultCurrency?: string };
        };
        setProfile(pr.profile ?? null);
      }
    } catch {
      setSaveMsg("Network hiccup — retry.");
    } finally {
      setSaving(false);
    }
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
  const usdNgn = 1360;
  const fiatOf = (minor: number, currency: string) => {
    const v = minor / 10 ** (DECIMALS[currency] ?? 2);
    if (currency === "SOL" && prices?.solUsd) return v * prices.solUsd * usdNgn;
    if (currency === "USDC" && prices?.usdcUsd) return v * prices.usdcUsd * usdNgn;
    return 0;
  };
  const worthTotal = balances
    ? Math.round(fiatOf(balances.SOL ?? 0, "SOL") + fiatOf(balances.USDC ?? 0, "USDC"))
    : 0;

  const rail = (
    <nav
      aria-label="Dashboard"
      className="flex flex-row justify-around gap-1 rounded-[28px] border border-espresso bg-ember-night p-2 sm:flex-col sm:justify-start sm:gap-2 sm:rounded-[24px] sm:p-3"
    >
      {TABS.map((t) => (
        <button
          key={t.id}
          type="button"
          onClick={() => setTab(t.id)}
          aria-current={tab === t.id ? "page" : undefined}
          aria-label={t.label}
          title={t.label}
          className={`flex flex-col items-center gap-1 rounded-[20px] px-4 py-2 text-[14px] font-medium transition-colors sm:w-full sm:flex-row sm:gap-2 sm:px-4 sm:py-3 ${
            tab === t.id
              ? "bg-ember-glow text-espresso"
              : "text-pure-white hover:bg-bark"
          }`}
        >
          <span aria-hidden className="inline-flex">
            <t.icon size={20} strokeWidth={2} />
          </span>
          <span className="text-[10px] leading-none font-medium sm:text-[14px] sm:leading-normal">{t.label}</span>
        </button>
      ))}
    </nav>
  );

  return (
    <div ref={root} className="sm:flex sm:items-start sm:gap-6">
      {/* Desktop rail */}
      <div
        className={`mb-6 hidden w-[220px] shrink-0 sm:mb-0 sm:block ${
          railSide === "right" ? "sm:order-last" : ""
        }`}
      >
        <div className="sm:sticky sm:top-6">{rail}</div>
      </div>

      <div className="min-w-0 flex-1 pb-28 sm:pb-0">
        {tab === "home" && (
          <>
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

            {/* Balance */}
            <section
              aria-labelledby="dash-balance"
              className="dash-rise mt-6 rounded-[20px] border border-espresso bg-warm-bone p-6 sm:p-8"
            >
              <h3
                id="dash-balance"
                className="text-[14px] font-semibold tracking-[0.05em] text-taupe uppercase"
              >
                Balance 💰
              </h3>
              {balances ? (
                <div className="mt-2">
                  <p className="text-[40px] leading-[1.2] font-semibold tracking-[-0.031em]">
                    {money(balances.SOL ?? 0, "SOL")}
                  </p>
                  <p className="mt-1 text-[16px] text-taupe">
                    {money(balances.USDC ?? 0, "USDC")}
                  </p>
                  {prices?.solUsd && (
                    <p className="mt-1 text-[14px] font-semibold">
                      Worth ≈ ₦{worthTotal.toLocaleString("en-NG")} total
                      {!prices.live && (
                        <span className="font-normal text-taupe"> (last known rate)</span>
                      )}
                    </p>
                  )}
                </div>
              ) : (
                <p className="mt-2 text-[16px] text-taupe" role="status">
                  Balance unreachable — retry in a minute.
                </p>
              )}
              <form onSubmit={onFund} noValidate className="mt-6" id="dash-fund">
                {pendingPayments.length > 0 && (
                  <div
                    role="status"
                    className="mb-4 rounded-[16px] border border-deep-ember bg-ember-wash p-4"
                  >
                    <p className="text-[14px] font-medium text-bark">
                      {pendingPayments.length === 1
                        ? "You have 1 pending payment."
                        : `You have ${pendingPayments.length} pending payments.`}{" "}
                      Paid already?
                    </p>
                    <button
                      type="button"
                      onClick={onCheckPayment}
                      disabled={checking}
                      className="mt-3 rounded-[20px] bg-ember-glow px-4 py-2 text-[14px] font-medium text-espresso transition-colors hover:bg-bark hover:text-pure-white disabled:opacity-60"
                    >
                      {checking ? "Checking…" : "I've paid — check status"}
                    </button>
                    {checkMsg && (
                      <p className="mt-2 text-[14px] font-medium text-bark">{checkMsg}</p>
                    )}
                  </div>
                )}
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
                <label htmlFor="fund-asset" className="sr-only">
                  Asset to receive
                </label>
                <select
                  id="fund-asset"
                  value={fundAsset}
                  onChange={(e) => setFundAsset(e.target.value === "USDC" ? "USDC" : "SOL")}
                  className="rounded-[24px] border border-espresso bg-pure-white px-4 py-3 text-[16px] focus:border-deep-ember focus:outline-none sm:max-w-[140px]"
                >
                  <option value="SOL">SOL</option>
                  <option value="USDC">USDC</option>
                </select>
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

            {/* Prices */}
            <section
              aria-labelledby="dash-prices"
              className="dash-rise mt-6 rounded-[20px] border border-espresso bg-warm-bone p-6 sm:p-8"
            >
              <h3
                id="dash-prices"
                className="text-[20px] leading-[1.43] font-semibold tracking-[-0.015em]"
              >
                Prices
              </h3>
              <ul className="mt-4 divide-y divide-espresso/10">
                <li className="flex items-center justify-between gap-4 py-3">
                  <p className="text-[14px] font-semibold">SOL</p>
                  <p className="text-[14px]">
                    {prices?.solUsd ? `$${prices.solUsd.toLocaleString("en-US")}` : "—"}
                    <span className="ml-2 text-[12px] text-taupe">live</span>
                  </p>
                </li>
                <li className="flex items-center justify-between gap-4 py-3">
                  <p className="text-[14px] font-semibold">USDC</p>
                  <p className="text-[14px]">
                    {prices?.usdcUsd ? `$${prices.usdcUsd.toLocaleString("en-US")}` : "—"}
                    <span className="ml-2 text-[12px] text-taupe">live</span>
                  </p>
                </li>
                <li className="flex items-center justify-between gap-4 py-3">
                  <div>
                    <p className="text-[14px] font-semibold">AMANA 🪙</p>
                    <p className="mt-1 text-[12px] text-taupe">
                      Liability mirror — no market price. Backed 1:1 on devnet
                      {mirror?.allMatch === true ? " · reserves match ✓" : mirror ? " · check reserves" : ""}.
                    </p>
                  </div>
                  <span className="shrink-0 rounded-[20px] bg-ember-wash px-3 py-1 text-[12px] font-medium text-bark">
                    mirror
                  </span>
                </li>
              </ul>
            </section>

            {/* Highlights */}
            <section
              aria-labelledby="dash-highlights"
              className="dash-rise mt-6 rounded-[20px] border border-espresso bg-warm-bone p-6 sm:p-8"
            >
              <h3
                id="dash-highlights"
                className="text-[20px] leading-[1.43] font-semibold tracking-[-0.015em]"
              >
                This month
              </h3>
              <div className="mt-4 flex gap-8">
                <div>
                  <p className="text-[12px] font-semibold tracking-[0.05em] text-taupe uppercase">
                    Funded
                  </p>
                  <p className="mt-1 text-[24px] font-semibold">
                    {naira(Math.round(highlights.inn * 100))}
                  </p>
                </div>
                <div>
                  <p className="text-[12px] font-semibold tracking-[0.05em] text-taupe uppercase">
                    Recent
                  </p>
                  <p className="mt-1 max-w-[40ch] truncate text-[14px] text-taupe">
                    {transfers.length > 0 && transfers[0]
                      ? `${transfers[0].direction === "received" ? "📩" : "📤"} ${money(transfers[0].amountMinor, transfers[0].currency)}`
                      : "Nothing yet"}
                  </p>
                </div>
              </div>
            </section>

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
                  Buying and sending unlock after verification.
                </p>
                <a
                  href="/kyc"
                  className="mt-6 inline-block rounded-[28px] bg-ember-glow px-5 py-2 text-[14px] font-medium text-espresso transition-colors hover:bg-bark hover:text-pure-white"
                >
                  Verify identity
                </a>
              </section>
            )}
          </>
        )}

        {tab === "activity" && (
          <section
            aria-labelledby="dash-tx"
            className="dash-rise rounded-[20px] border border-espresso bg-warm-bone p-6 sm:p-8"
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h3
                id="dash-tx"
                className="text-[20px] leading-[1.43] font-semibold tracking-[-0.015em]"
              >
                Activity
              </h3>
              <div className="flex flex-wrap items-center gap-2">
                <label htmlFor="month-filter" className="sr-only">
                  Filter by month
                </label>
                <select
                  id="month-filter"
                  value={month}
                  onChange={(e) => setMonth(e.target.value)}
                  className="rounded-[20px] border border-espresso bg-pure-white px-3 py-1 text-[14px] focus:border-deep-ember focus:outline-none"
                >
                  <option value="all">All months</option>
                  {months.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={exportCsv}
                  className="rounded-[20px] bg-ember-glow px-3 py-1 text-[14px] font-medium text-espresso transition-colors hover:bg-bark hover:text-pure-white"
                >
                  Export CSV
                </button>
              </div>
            </div>
            {payments.length + transfers.length === 0 ? (
              <p className="mt-4 max-w-[52ch] text-[14px] leading-[1.5]">
                No transactions yet. Your history will appear here after your
                first funding — and in chat after your first buy.
              </p>
            ) : (
              <ul className="mt-4 divide-y divide-espresso/10">
                {transfers
                  .filter((t) =>
                    month === "all" ||
                    (t.createdAt != null &&
                      new Date(t.createdAt).toISOString().slice(0, 7) === month),
                  )
                  .map((t, i) => (
                    <li
                      key={`t-${t.counterparty}-${t.createdAt}-${i}`}
                      className="flex items-center justify-between gap-4 py-3"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-[14px] font-semibold">
                          <span
                            aria-label={t.direction === "received" ? "Received" : "Sent"}
                          >
                            {t.direction === "received" ? "📩 " : "📤 "}
                          </span>
                          {money(t.amountMinor, t.currency)}
                        </p>
                        <p className="mt-1 truncate font-mono text-[12px] text-taupe">
                          {t.direction === "received" ? "from " : "to "}
                          {t.counterparty ?? "—"} · {fmtDate(t.createdAt)}
                        </p>
                      </div>
                      <span className="shrink-0 rounded-[20px] bg-ember-wash px-3 py-1 text-[12px] font-medium text-bark">
                        {t.direction === "received" ? "received" : t.status}
                      </span>
                    </li>
                  ))}
                {(month === "all"
                  ? payments
                  : payments.filter((p) => {
                      const ms = p.paidAt ?? p.createdAt;
                      return ms != null && new Date(ms).toISOString().slice(0, 7) === month;
                    })
                ).map((p) => (
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
        )}

        {tab === "security" && (
          <section
            aria-labelledby="dash-pin"
            className="dash-rise rounded-[20px] border border-espresso bg-warm-bone p-6 sm:p-8"
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
        )}

        {tab === "settings" && (
          <section
            aria-labelledby="dash-settings"
            className="dash-rise rounded-[20px] border border-espresso bg-warm-bone p-6 sm:p-8"
          >
            <h3
              id="dash-settings"
              className="text-[20px] leading-[1.43] font-semibold tracking-[-0.015em]"
            >
              Settings
            </h3>
            {saveMsg && (
              <p role="status" className="mt-4 text-[14px] font-medium">
                {saveMsg}
              </p>
            )}
            <form onSubmit={onSaveProfile} className="mt-6 flex flex-col gap-6">
              <div>
                <label htmlFor="set-name" className="text-[14px] font-semibold">
                  Full name
                </label>
                <input
                  id="set-name"
                  name="fullName"
                  type="text"
                  autoComplete="name"
                  defaultValue={profile?.name ?? ""}
                  maxLength={80}
                  placeholder="Adaeze Okafor"
                  className="mt-2 w-full rounded-[24px] border border-espresso bg-pure-white px-4 py-3 text-[16px] placeholder:text-taupe focus:border-deep-ember focus:outline-none"
                />
                <p className="mt-2 text-[12px] text-taupe">The bot greets you by this name.</p>
              </div>
              <div>
                <label htmlFor="set-email" className="text-[14px] font-semibold">
                  Contact email
                </label>
                <input
                  id="set-email"
                  name="contactEmail"
                  type="email"
                  autoComplete="email"
                  defaultValue={profile?.contactEmail ?? ""}
                  placeholder="you@example.com"
                  className="mt-2 w-full rounded-[24px] border border-espresso bg-pure-white px-4 py-3 text-[16px] placeholder:text-taupe focus:border-deep-ember focus:outline-none"
                />
                <p className="mt-2 text-[12px] text-taupe">Receipts and notifications. Optional.</p>
              </div>
              <div>
                <label htmlFor="set-currency" className="text-[14px] font-semibold">
                  Default currency
                </label>
                <select
                  id="set-currency"
                  name="defaultCurrency"
                  defaultValue={profile?.defaultCurrency ?? "NGN"}
                  className="mt-2 w-full rounded-[24px] border border-espresso bg-pure-white px-4 py-3 text-[16px] focus:border-deep-ember focus:outline-none"
                >
                  <option value="NGN">NGN — naira first</option>
                  <option value="SOL">SOL — crypto first</option>
                  <option value="USDC">USDC — stable first</option>
                </select>
                <p className="mt-2 text-[12px] text-taupe">
                  Prefills buys and sends that don’t name a currency. Chat always prints the unit.
                </p>
              </div>
              <div>
                <span id="rail-side-label" className="text-[14px] font-semibold">
                  Navigation side (desktop)
                </span>
                <div className="mt-2 flex gap-2" role="group" aria-labelledby="rail-side-label">
                  {(["left", "right"] as const).map((side) => (
                    <button
                      key={side}
                      type="button"
                      onClick={() => setSide(side)}
                      aria-pressed={railSide === side}
                      className={`rounded-[20px] px-4 py-2 text-[14px] font-medium transition-colors ${
                        railSide === side
                          ? "bg-ember-glow text-espresso"
                          : "border border-espresso hover:bg-espresso hover:text-pure-white"
                      }`}
                    >
                      {side === "left" ? (
                      <span className="inline-flex items-center gap-1">
                        <ChevronLeft size={16} /> Left
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1">
                        Right <ChevronRight size={16} />
                      </span>
                    )}
                    </button>
                  ))}
                </div>
              </div>
              <button
                type="submit"
                disabled={saving}
                className="rounded-[28px] bg-ember-glow px-5 py-3 text-[16px] font-medium text-espresso transition-colors hover:bg-bark hover:text-pure-white disabled:opacity-60 sm:w-auto"
              >
                {saving ? "Saving…" : "Save settings"}
              </button>
            </form>
          </section>
        )}
      </div>

      {/* Mobile bottom bar */}
      <div className="fixed inset-x-0 bottom-0 z-10 border-t border-espresso bg-ember-night/95 p-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] backdrop-blur sm:hidden">
        {rail}
      </div>
    </div>
  );
}
