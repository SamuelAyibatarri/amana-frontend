import type { Metadata } from "next";
import Image from "next/image";
import KycForm from "@/components/KycForm";

export const metadata: Metadata = {
  title: "Verify identity — Amana",
  description:
    "Mock identity check for the Amana hackathon build. Any 11-digit BVN + NIN passes.",
};

export default function KycPage() {
  return (
    <div className="on-light min-h-screen bg-pure-white text-espresso">
      <a
        href="#kyc-main"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:rounded-[28px] focus:bg-ember-glow focus:px-5 focus:py-2 focus:text-[14px] focus:font-medium focus:text-espresso"
      >
        Skip to content
      </a>
      <header className="mx-auto flex max-w-[1200px] items-center justify-between px-4 py-6 sm:px-8">
        <a href="/" aria-label="Amana home" className="flex items-center gap-2">
          <Image src="/logo.svg" alt="" width={40} height={25} />
          <span className="text-[16px] font-semibold tracking-[-0.02em]">
            Amana
          </span>
        </a>
        <span className="rounded-[40px] bg-ember-wash px-3 py-1 text-[12px] font-medium text-bark">
          Mock check
        </span>
      </header>
      <main id="kyc-main" className="mx-auto max-w-[640px] scroll-mt-24 px-4 pt-8 pb-20 sm:px-8">
        <p className="font-instrument-serif text-[18px] text-taupe italic">
          one last step before money moves
        </p>
        <h1 className="mt-4 text-[32px] leading-[1.2] font-semibold tracking-[-0.021em] text-balance">
          Verify your identity
        </h1>
        <p className="mt-4 max-w-[52ch] text-[16px] leading-[1.5]">
          Enter your BVN and NIN below. This demo build approves anything
          exactly 11 digits — approval unlocks your transfer limits instantly.
        </p>
        <div className="mt-8 rounded-[20px] border border-espresso bg-warm-bone p-6 sm:p-8">
          <KycForm />
        </div>
      </main>
    </div>
  );
}
