"use client";

import { useEffect, useState } from "react";
import Image from "next/image";

const LINKS = [
  ["How it works", "#how"],
  ["Cash out", "#cashout"],
  ["KYC (mock)", "/kyc"],
  ["How it's built", "#inside"],
] as const;

const SCROLL_PAST = 40;

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > SCROLL_PAST);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div
      className="nav-morph sticky top-0 z-50 px-4 transition-[padding] duration-300 sm:px-8"
      style={{
        paddingTop: scrolled ? "16px" : "32px",
        paddingBottom: scrolled ? "16px" : "8px",
        pointerEvents: "none",
      }}
    >
      <nav
        aria-label="Primary"
        className="nav-morph pointer-events-auto mx-auto transition-[background-color,border-color,padding,max-width,box-shadow] duration-300"
        style={{
          maxWidth: scrolled ? "calc(1200px - 48px)" : "1200px",
          margin: "0 auto",
          background: scrolled
            ? "color-mix(in srgb, var(--color-espresso) 72%, transparent)"
            : "transparent",
          backdropFilter: scrolled ? "blur(16px)" : "none",
          WebkitBackdropFilter: scrolled ? "blur(16px)" : "none",
          border: scrolled
            ? "1px solid color-mix(in srgb, var(--color-sand) 35%, transparent)"
            : "1px solid transparent",
          borderRadius: "28px",
          padding: scrolled ? "12px 16px" : "16px 16px",
          boxShadow: scrolled ? "0 8px 32px rgba(0, 0, 0, 0.35)" : "none",
        }}
      >
        <div className="flex items-center justify-between gap-4">
          <a href="#top" aria-label="Amana home" className="flex items-center gap-2">
            <Image src="/logo.svg" alt="" width={40} height={25} priority />
            <span className="text-[16px] font-semibold tracking-[-0.02em] text-pure-white">
              Amana
            </span>
            <span className="rounded-[40px] bg-ember-glow px-3 py-1 text-[8px] font-medium tracking-[0.05em] text-espresso uppercase">
              Devnet
            </span>
          </a>
          <div className="hidden items-center gap-1 lg:flex">
            {LINKS.map(([label, href]) => (
              <a
                key={href}
                href={href}
                className="rounded-lg px-3 py-[7px] text-[14px] font-medium text-taupe transition-colors hover:text-pure-white"
              >
                {label}
              </a>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <a
              href="/signin"
              className="hidden rounded-[28px] border border-pure-white px-4 py-1.5 text-[14px] font-medium text-pure-white transition-colors hover:bg-pure-white hover:text-espresso sm:inline-block"
            >
              Sign in
            </a>
            <a
              href="/kyc"
              className="rounded-[28px] bg-ember-glow px-5 py-2 text-[14px] font-medium text-espresso transition-colors hover:bg-pure-white"
            >
              Get started
            </a>
          </div>
        </div>
      </nav>
    </div>
  );
}
