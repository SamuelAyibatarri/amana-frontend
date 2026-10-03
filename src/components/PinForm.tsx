"use client";

import { useEffect, useState } from "react";

type Main = "loading" | "form" | "done";
type Forgot = "idle" | "sending" | "sent";

const FOUR = /^\d{4}$/;
const SIX = /^\d{6}$/;

/**
 * Transaction PIN management: first set, change (current required),
 * or forgot (WhatsApp OTP confirmation).
 */
export default function PinForm() {
  const [main, setMain] = useState<Main>("loading");
  const [hasPin, setHasPin] = useState(false);
  const [current, setCurrent] = useState("");
  const [pin, setPin] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [working, setWorking] = useState(false);
  const [forgot, setForgot] = useState<Forgot>("idle");
  const [otp, setOtp] = useState("");
  const [delivered, setDelivered] = useState(true);

  const digits = (v: string, n: number) => v.replace(/\D/g, "").slice(0, n);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/pin/status")
      .then((res) => res.json())
      .then((data: unknown) => {
        if (cancelled) return;
        setHasPin((data as { set?: boolean })?.set === true);
        setMain("form");
      })
      .catch(() => {
        if (!cancelled) setMain("form");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (hasPin && !FOUR.test(current)) {
      setError("Enter your current PIN.");
      return;
    }
    if (!FOUR.test(pin)) {
      setError("New PIN must be exactly 4 digits.");
      return;
    }
    if (pin !== confirm) {
      setError("PINs don't match — re-enter both.");
      return;
    }
    setError("");
    setWorking(true);
    try {
      const res = await fetch("/api/pin/set", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(hasPin ? { pin, currentPin: current } : { pin }),
      });
      const data = (await res.json()) as { error?: string };
      if (res.ok) {
        setMain("done");
        setHasPin(true);
        setCurrent("");
        setPin("");
        setConfirm("");
      } else {
        setError(data.error ?? "Could not save the PIN. Retry.");
      }
    } catch {
      setError("Network hiccup — check your connection and retry.");
    } finally {
      setWorking(false);
    }
  }

  async function onForgot() {
    setError("");
    setForgot("sending");
    try {
      const res = await fetch("/api/pin/forgot", { method: "POST" });
      const data = (await res.json()) as { delivered?: boolean; error?: string };
      if (res.ok) {
        setDelivered(data.delivered !== false);
        setForgot("sent");
      } else {
        setError(data.error ?? "Could not send a code. Retry.");
        setForgot("idle");
      }
    } catch {
      setError("Network hiccup — check your connection and retry.");
      setForgot("idle");
    }
  }

  async function onReset(e: React.FormEvent) {
    e.preventDefault();
    if (!SIX.test(otp)) {
      setError("The code is 6 digits.");
      return;
    }
    if (!FOUR.test(pin) || pin !== confirm) {
      setError("New PIN must be 4 digits and match in both fields.");
      return;
    }
    setError("");
    setWorking(true);
    try {
      const res = await fetch("/api/pin/reset", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ otp, pin }),
      });
      const data = (await res.json()) as { error?: string };
      if (res.ok) {
        setMain("done");
        setHasPin(true);
        setForgot("idle");
        setOtp("");
        setPin("");
        setConfirm("");
      } else {
        setError(data.error ?? "Reset failed. Retry.");
      }
    } catch {
      setError("Network hiccup — check your connection and retry.");
    } finally {
      setWorking(false);
    }
  }

  if (main === "loading") {
    return (
      <p className="text-[14px]" role="status" aria-live="polite">
        Checking PIN state…
      </p>
    );
  }

  if (main === "done") {
    return (
      <div role="status" aria-live="polite">
        <span className="inline-block rounded-[20px] bg-ember-wash px-3 py-1 text-[12px] font-medium text-bark">
          PIN saved
        </span>
        <p className="mt-4 text-[20px] leading-[1.43] font-semibold tracking-[-0.015em]">
          Done. Use it in chat.
        </p>
        <p className="mt-2 max-w-[52ch] text-[14px] leading-[1.5]">
          The bot asks for these 4 digits to approve payments. Never share
          them — support will never ask.
        </p>
        <button
          type="button"
          onClick={() => setMain("form")}
          className="mt-6 text-[14px] font-medium text-taupe underline-offset-4 hover:underline"
        >
          Change it again
        </button>
      </div>
    );
  }

  return (
    <div>
      {error && (
        <p
          role="alert"
          className="mb-6 rounded-[16px] border border-deep-ember bg-ember-wash p-4 text-[14px] font-medium text-bark"
        >
          {error}
        </p>
      )}
      {forgot === "sent" ? (
        <form onSubmit={onReset} noValidate>
          <p className="max-w-[52ch] text-[14px] leading-[1.5]">
            {delivered
              ? "Code sent to your WhatsApp — enter it below with your new PIN."
              : "Code created but WhatsApp delivery failed — ask for a fresh one or check the bot backend."}
          </p>
          <div className="mt-4 grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label htmlFor="otp-input" className="text-[14px] font-semibold">
                6-digit code
              </label>
              <input
                id="otp-input"
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder="••••••"
                maxLength={6}
                value={otp}
                onChange={(e) => setOtp(digits(e.target.value, 6))}
                className="mt-2 w-full rounded-[24px] border border-espresso bg-pure-white px-4 py-3 text-center text-[20px] tracking-[0.5em] placeholder:text-taupe focus:border-deep-ember focus:outline-none"
              />
            </div>
            <div>
              <label htmlFor="pin-new2" className="text-[14px] font-semibold">
                New PIN
              </label>
              <input
                id="pin-new2"
                type="password"
                inputMode="numeric"
                autoComplete="new-password"
                placeholder="••••"
                maxLength={4}
                value={pin}
                onChange={(e) => setPin(digits(e.target.value, 4))}
                className="mt-2 w-full rounded-[24px] border border-espresso bg-pure-white px-4 py-3 text-center text-[20px] tracking-[0.5em] placeholder:text-taupe focus:border-deep-ember focus:outline-none"
              />
            </div>
            <div>
              <label htmlFor="pin-confirm2" className="text-[14px] font-semibold">
                Confirm
              </label>
              <input
                id="pin-confirm2"
                type="password"
                inputMode="numeric"
                autoComplete="new-password"
                placeholder="••••"
                maxLength={4}
                value={confirm}
                onChange={(e) => setConfirm(digits(e.target.value, 4))}
                className="mt-2 w-full rounded-[24px] border border-espresso bg-pure-white px-4 py-3 text-center text-[20px] tracking-[0.5em] placeholder:text-taupe focus:border-deep-ember focus:outline-none"
              />
            </div>
          </div>
          <div className="mt-8 flex flex-wrap items-center gap-4">
            <button
              type="submit"
              disabled={working}
              className="rounded-[28px] bg-ember-glow px-5 py-3 text-[16px] font-medium text-espresso transition-colors hover:bg-bark hover:text-pure-white disabled:opacity-60"
            >
              {working ? "Resetting…" : "Reset PIN"}
            </button>
            <button
              type="button"
              onClick={() => {
                setForgot("idle");
                setOtp("");
              }}
              className="text-[14px] font-medium text-taupe underline-offset-4 hover:underline"
            >
              Back
            </button>
          </div>
        </form>
      ) : (
        <form onSubmit={onSubmit} noValidate>
          {hasPin && (
            <div className="mb-4">
              <label htmlFor="pin-current" className="text-[14px] font-semibold">
                Current PIN
              </label>
              <input
                id="pin-current"
                type="password"
                inputMode="numeric"
                autoComplete="current-password"
                placeholder="••••"
                maxLength={4}
                value={current}
                onChange={(e) => setCurrent(digits(e.target.value, 4))}
                className="mt-2 w-full rounded-[24px] border border-espresso bg-pure-white px-4 py-3 text-center text-[20px] tracking-[0.5em] placeholder:text-taupe focus:border-deep-ember focus:outline-none"
              />
            </div>
          )}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="pin-new" className="text-[14px] font-semibold">
                {hasPin ? "New PIN" : "PIN"}
              </label>
              <input
                id="pin-new"
                type="password"
                inputMode="numeric"
                autoComplete="new-password"
                placeholder="••••"
                maxLength={4}
                value={pin}
                onChange={(e) => setPin(digits(e.target.value, 4))}
                className="mt-2 w-full rounded-[24px] border border-espresso bg-pure-white px-4 py-3 text-center text-[20px] tracking-[0.5em] placeholder:text-taupe focus:border-deep-ember focus:outline-none"
              />
            </div>
            <div>
              <label htmlFor="pin-confirm" className="text-[14px] font-semibold">
                Confirm
              </label>
              <input
                id="pin-confirm"
                type="password"
                inputMode="numeric"
                autoComplete="new-password"
                placeholder="••••"
                maxLength={4}
                value={confirm}
                onChange={(e) => setConfirm(digits(e.target.value, 4))}
                className="mt-2 w-full rounded-[24px] border border-espresso bg-pure-white px-4 py-3 text-center text-[20px] tracking-[0.5em] placeholder:text-taupe focus:border-deep-ember focus:outline-none"
              />
            </div>
          </div>
          <div className="mt-8 flex flex-wrap items-center gap-4">
            <button
              type="submit"
              disabled={working}
              className="rounded-[28px] bg-ember-glow px-5 py-3 text-[16px] font-medium text-espresso transition-colors hover:bg-bark hover:text-pure-white disabled:opacity-60"
            >
              {working ? "Saving…" : hasPin ? "Change PIN" : "Save PIN"}
            </button>
            {hasPin && (
              <button
                type="button"
                onClick={onForgot}
                disabled={forgot === "sending"}
                className="text-[14px] font-medium text-taupe underline-offset-4 hover:underline disabled:opacity-60"
              >
                {forgot === "sending" ? "Sending code…" : "Forgot PIN?"}
              </button>
            )}
          </div>
        </form>
      )}
    </div>
  );
}
