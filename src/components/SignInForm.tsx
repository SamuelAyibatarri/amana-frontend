"use client";

import { useRef, useState } from "react";
import { authClient } from "@/lib/auth-client";

type State = "idle" | "working" | "sent" | "error";

/**
 * Demo sign-in: enter the WhatsApp number, get the magic link in chat.
 * Better Auth generates the link; the worker sends it to your WhatsApp.
 * Single landing: /dashboard (server guards route onward from there).
 */
export default function SignInForm() {
  const [phone, setPhone] = useState("");
  const [state, setState] = useState<State>("idle");
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const digitsOnly = (v: string) => v.replace(/\D/g, "").slice(0, 15);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const digits = phone.replace(/\D/g, "");
    if (digits.length < 7) {
      setError("Enter your WhatsApp number in international format, e.g. 2348012345678.");
      inputRef.current?.focus();
      return;
    }
    setError("");
    setState("working");
    const { error: err } = await authClient.signIn.magicLink({
      email: `${digits}@amana.whatsapp`,
      callbackURL: "/dashboard",
    });
    if (err) {
      setError(err.message ?? "Could not send the WhatsApp link. Retry.");
      setState("error");
      return;
    }
    setState("sent");
  }

  if (state === "sent") {
    return (
      <div role="status" aria-live="polite">
        <span className="inline-block rounded-[20px] bg-ember-wash px-3 py-1 text-[12px] font-medium text-bark">
          Link sent
        </span>
        <p className="mt-4 text-[24px] leading-[1.33] font-semibold tracking-[-0.015em]">
          Check your WhatsApp.
        </p>
        <p className="mt-2 max-w-[52ch] text-[14px] leading-[1.5]">
          Tap the sign-in link in chat — it signs you in and takes you
          where you need to go. The link expires in 15 minutes.
        </p>
        <div className="mt-6">
          <button
            type="button"
            onClick={() => setState("idle")}
            className="text-[14px] font-medium text-taupe underline-offset-4 hover:underline"
          >
            Use a different number
          </button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate>
      {error && (
        <p
          role="alert"
          className="mb-6 rounded-[16px] border border-deep-ember bg-ember-wash p-4 text-[14px] font-medium text-bark"
        >
          {error}
        </p>
      )}
      <label htmlFor="phone-input" className="text-[14px] font-semibold">
        WhatsApp number
      </label>
      <input
        ref={inputRef}
        id="phone-input"
        name="phone"
        type="tel"
        inputMode="numeric"
        autoComplete="tel"
        spellCheck={false}
        placeholder="e.g. 2348012345678"
        maxLength={15}
        value={phone}
        onChange={(e) => setPhone(digitsOnly(e.target.value))}
        aria-invalid={!!error}
        className="mt-2 w-full rounded-[24px] border border-espresso bg-pure-white px-4 py-3 text-[16px] tracking-[-0.01em] placeholder:text-taupe focus:border-deep-ember focus:outline-none"
      />
      <p className="mt-2 text-[12px] text-taupe">
        International format, numbers only — no + or spaces.
      </p>
      <button
        type="submit"
        disabled={state === "working"}
        className="mt-8 w-full rounded-[28px] bg-ember-glow px-5 py-3 text-[16px] font-medium text-espresso transition-colors hover:bg-bark hover:text-pure-white disabled:opacity-60 sm:w-auto"
      >
        {state === "working" ? "Sending…" : "Send WhatsApp link"}
      </button>
    </form>
  );
}
