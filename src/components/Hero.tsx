"use client";

import { useRef } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import DemoTrio from "@/components/DemoTrio";
import DoodleBand from "@/components/DoodleBand";
import GetStartedCta from "@/components/GetStartedCta";

gsap.registerPlugin(useGSAP);

const TRUST = [
  { name: "Solana", logo: "/logos/solana.svg", width: 118 },
  { name: "Paystack", logo: "/logos/paystack.svg", width: 118 },
  { name: "WhatsApp", logo: "/logos/whatsapp.svg", width: 132 },
] as const;

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
      <DoodleBand />

      <div className="relative mx-auto max-w-[1200px] px-4 pt-16 pb-20 sm:px-8 sm:pt-24 sm:pb-28">
        <div className="flex flex-col items-center text-center">
          <a
            href="/kyc"
            className="hero-cta inline-flex items-center gap-2 rounded-full border border-taupe px-4 py-1 text-[14px] text-pure-white transition-colors hover:border-ember-glow"
          >
            Verify in seconds, transact in chat
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
            <GetStartedCta tone="hero" />
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
            Built on rails you already trust
          </p>
          <ul className="mt-6 flex list-none flex-wrap items-center justify-center gap-10 p-0" aria-label="Ecosystem">
            {TRUST.map(({ name, logo, width }) => (
              <li
                key={name}
                className="flex h-12 items-center opacity-60 transition-opacity hover:opacity-100"
              >
                <img
                  src={logo}
                  alt={name}
                  width={width}
                  height={24}
                  loading="lazy"
                  className="h-6 w-auto"
                />
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
