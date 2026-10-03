"use client";

import { useRef } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import DemoTrio from "@/components/DemoTrio";

gsap.registerPlugin(useGSAP);

const TRUST = ["Solana", "Paystack", "WhatsApp"] as const;

export default function Hero() {
  const root = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        const tl = gsap.timeline({ defaults: { ease: "power3.out" } });
        tl.fromTo(
          ".hero-display",
          { y: 40, opacity: 0 },
          { y: 0, opacity: 1, duration: 0.7 },
        )
          .fromTo(
            ".hero-tag",
            { y: 24, opacity: 0 },
            { y: 0, opacity: 1, duration: 0.5 },
            "-=0.35",
          )
          .fromTo(
            ".hero-cta",
            { y: 16, opacity: 0 },
            { y: 0, opacity: 1, duration: 0.4, stagger: 0.08 },
            "-=0.25",
          )
          .fromTo(
            ".hero-mockup",
            { y: 48, opacity: 0 },
            { y: 0, opacity: 1, duration: 0.6, stagger: 0.12 },
            "-=0.3",
          );
      });
    },
    { scope: root },
  );

  return (
    <section
      ref={root}
      aria-labelledby="hero-heading"
      className="relative overflow-hidden bg-ember-night"
    >
      <div
        aria-hidden
        className="ember-orb absolute top-[-160px] right-[-120px] h-[480px] w-[480px] opacity-40"
      />
      <div
        aria-hidden
        className="ember-orb absolute bottom-[-200px] left-[-160px] h-[420px] w-[420px] opacity-30"
      />

      <div className="relative mx-auto max-w-[1200px] px-4 pt-16 pb-20 sm:px-8 sm:pt-24 sm:pb-28">
        <div className="flex flex-col items-center text-center">
          <a
            href="/kyc"
            className="hero-cta inline-flex items-center gap-2 rounded-full border border-taupe px-4 py-1 text-[14px] text-pure-white transition-colors hover:border-ember-glow"
          >
            Mock KYC is live for the hackathon
            <span className="text-ember-glow">· any 11-digit BVN + NIN passes</span>
            <span aria-hidden className="text-taupe">
              ›
            </span>
          </a>
          <h1 id="hero-heading" className="hero-display display-hero mt-8 max-w-[16ch] text-balance">
            Money that lives in <span className="text-ember-glow">chat</span>
          </h1>
          <p className="hero-tag mt-6 max-w-[60ch] text-[18px] leading-[1.5] text-sand">
            Amana is a custodial Solana wallet inside WhatsApp. Buy, send, and
            cash out with plain words — <span className="text-ember-glow">no gas math</span>,
            no seed phrases, no exchange accounts.
          </p>
          <div className="mt-8 flex flex-col items-center gap-4 sm:flex-row">
            <a
              href="/kyc"
              className="hero-cta rounded-[28px] bg-ember-glow px-5 py-2 text-[16px] font-medium text-espresso transition-colors hover:bg-pure-white"
            >
              Launch Web App
            </a>
            <a
              href="#how"
              className="hero-cta inline-flex items-center gap-2 rounded-[28px] border border-pure-white px-5 py-2 text-[16px] font-medium text-pure-white transition-colors hover:border-ember-glow hover:text-ember-glow"
            >
              <span aria-hidden className="text-[12px]">
                ▶
              </span>
              How it works
            </a>
          </div>
        </div>

        <div className="mt-16 flex justify-center">
          <DemoTrio />
        </div>

        <div className="mt-16 text-center">
          <p className="text-[14px] text-sand">
            They put their trust in chat banking, as do more than 100,000 future users
          </p>
          <ul className="mt-6 flex list-none flex-wrap items-center justify-center gap-8 p-0" aria-label="Ecosystem">
            {TRUST.map((name) => (
              <li
                key={name}
                className="h-12 content-center text-[18px] font-semibold tracking-[-0.02em] text-pure-white opacity-50"
              >
                {name}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
