import { Suspense } from "react";
import Hero from "@/components/Hero";
import Navbar from "@/components/Navbar";
import DoodleBand from "@/components/DoodleBand";
import GetStartedCta from "@/components/GetStartedCta";
import QrDownloadCard from "@/components/QrDownloadCard";
import TokenHandler from "@/components/TokenHandler";

const STEPS = [
  {
    step: "Step 1",
    title: "Say hi in WhatsApp",
    body: "The bot onboards you in chat and hands you a magic link. No app install, no seed phrase to scribble down.",
  },
  {
    step: "Step 2",
    title: "Tap the link",
    body: "The link verifies on this site and signs you in. You land back here, ready to go.",
  },
  {
    step: "Step 3",
    title: "Transact in chat",
    body: "Type naturally — buy, send, check balance. Plain words in, money moved, network fees covered.",
  },
] as const;

const INSIDE_STEPS = [
  {
    step: "Sign-in",
    title: "Signed in by chat",
    body: "Your WhatsApp number is your identity. The bot sends a one-tap link; opening it signs you in. No passwords, no seed phrases.",
  },
  {
    step: "Identity",
    title: "Identity check, instant",
    body: "A BVN plus NIN check clears you for transfers. In this demo, any 11-digit pair passes.",
  },
  {
    step: "Wallet",
    title: "A wallet without the app",
    body: "Your Solana wallet lives with your account, not on your phone. No addresses to copy, no keys to guard.",
  },
  {
    step: "Fees",
    title: "Fees on us",
    body: "Every transfer shows its full cost up front, and network fees are covered — sending 0.5 SOL costs exactly that.",
  },
] as const;

const KYC_STEPS = [
  {
    step: "Step 1",
    title: "Sign in",
    body: "Open the WhatsApp sign-in link first — verification needs you signed in.",
  },
  {
    step: "Step 2",
    title: "Enter two numbers",
    body: "BVN + NIN. Eleven digits each, approval on the spot.",
  },
  {
    step: "Step 3",
    title: "Get cleared",
    body: "Approval is instant, and your transfer limits unlock right away.",
  },
] as const;

export default function Home() {
  return (
    <div id="top" className="bg-ember-night">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:rounded-[28px] focus:bg-ember-glow focus:px-5 focus:py-2 focus:text-[14px] focus:font-medium focus:text-espresso"
      >
        Skip to content
      </a>
      <Navbar />
      <main id="main" className="scroll-mt-24">
        <Hero />
        <div className="bg-pure-white pb-4">
          <Suspense>
            <TokenHandler />
          </Suspense>
        </div>

        <section
          id="how"
          aria-labelledby="how-heading"
          className="on-light scroll-mt-8 bg-pure-white text-espresso"
        >
          <div className="mx-auto max-w-300 px-4 py-20 sm:px-8 sm:py-28">
            <p className="font-instrument-serif text-[18px] text-taupe italic">
              no exchange, no wallet app, no gas math
            </p>
            <h2 id="how-heading" className="display-section mt-4 max-w-[16ch] text-balance">
              Chat. Tap. <span className="text-deep-ember">Done.</span>
            </h2>
            <ol className="mt-12 grid list-none grid-cols-1 gap-4 p-0 sm:grid-cols-3">
              {STEPS.map((step) => (
                <li
                  key={step.title}
                  className="rounded-[20px] border border-espresso bg-warm-bone p-6 sm:p-8"
                >
                  <p className="text-[12px] font-medium tracking-wider text-taupe uppercase">
                    {step.step}
                  </p>
                  <p className="mt-4 text-[20px] leading-[1.43] font-semibold tracking-[-0.015em]">
                    {step.title}
                  </p>
                  <p className="mt-2 text-[14px] leading-normal">{step.body}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section
          id="cashout"
          aria-labelledby="cashout-heading"
          className="relative scroll-mt-8 overflow-hidden bg-ember-night"
        >
          <DoodleBand opacity={0.12} />
          <div className="relative mx-auto max-w-300 px-4 py-20 sm:px-8 sm:py-28">
            <div className="grid grid-cols-1 items-center gap-12 xl:grid-cols-3 xl:gap-16">
              <div className="min-w-0">
                <p className="font-instrument-serif text-[18px] text-taupe italic">
                  Paystack in, Solana under the hood
                </p>
                <h2 id="cashout-heading" className="display-section mt-4 text-balance">
                  Cash out without leaving <span className="text-ember-glow">chat.</span>
                </h2>
                <p className="mt-6 max-w-[56ch] text-[18px] leading-normal text-sand">
                  Fund with Paystack, hold on Solana, and
                  send to any phone number. The web app is here when you want a
                  bigger screen.
                </p>
                <div className="mt-8">
                  <GetStartedCta tone="card" chatLabel="Start in WhatsApp" />
                </div>
              </div>
              <div className="on-light min-w-0 xl:col-span-2">
                <QrDownloadCard />
              </div>
            </div>
          </div>
        </section>

        <section
          id="kyc"
          aria-labelledby="kyc-heading"
          className="on-light scroll-mt-8 bg-pure-white text-espresso"
        >
          <div className="mx-auto max-w-300 px-4 py-20 text-center sm:px-8 sm:py-28">
            <h2 id="kyc-heading" className="display-section mx-auto mt-6 max-w-[16ch] text-balance">
              Identity, <span className="text-deep-ember">verified.</span>
            </h2>
            <p className="mx-auto mt-6 max-w-[60ch] text-[18px] leading-normal">
              Enter a BVN and a NIN — anything exactly 11 digits passes, and
              approval unlocks your transfer limits on the spot.
            </p>
            <ol className="mt-12 grid list-none grid-cols-1 gap-4 p-0 text-left sm:grid-cols-3">
              {KYC_STEPS.map((step) => (
                <li
                  key={step.title}
                  className="rounded-[20px] border border-espresso bg-warm-bone p-6 sm:p-8"
                >
                  <p className="text-[12px] font-medium tracking-wider text-taupe uppercase">
                    {step.step}
                  </p>
                  <p className="mt-4 text-[20px] leading-[1.43] font-semibold tracking-[-0.015em]">
                    {step.title}
                  </p>
                  <p className="mt-2 text-[14px] leading-normal">{step.body}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>
        <section
          id="inside"
          aria-labelledby="inside-heading"
          className="relative scroll-mt-8 overflow-hidden bg-ember-night"
        >
          <DoodleBand opacity={0.12} />
          <div className="relative mx-auto max-w-300 px-4 py-20 sm:px-8 sm:py-28">
            <p className="font-instrument-serif text-[18px] text-sand italic">
              real architecture, plain language
            </p>
            <h2 id="inside-heading" className="display-section mt-4 max-w-[16ch] text-balance">
              Under the <span className="text-ember-glow">hood.</span>
            </h2>
            <p className="mt-6 max-w-[60ch] text-[18px] leading-normal text-sand">
              How the pieces fit together — in plain language. Nothing here
              needs a blockchain degree to follow.
            </p>
            <ol className="mt-12 grid list-none grid-cols-1 gap-4 p-0 sm:grid-cols-2">
              {INSIDE_STEPS.map((step) => (
                <li
                  key={step.title}
                  className="rounded-[20px] border border-espresso p-6 sm:p-8"
                >
                  <p className="text-[12px] font-medium tracking-wider text-taupe uppercase">
                    {step.step}
                  </p>
                  <p className="mt-4 text-[20px] leading-[1.43] font-semibold tracking-[-0.015em]">
                    {step.title}
                  </p>
                  <p className="mt-2 max-w-[52ch] text-[14px] leading-normal text-sand">
                    {step.body}
                  </p>
                </li>
              ))}
            </ol>
          </div>
        </section>
      </main>

      <footer className="relative overflow-hidden bg-ember-night">
        <DoodleBand opacity={0.08} />
        <div className="relative mx-auto flex max-w-300 flex-col gap-4 px-4 py-12 sm:flex-row sm:items-center sm:justify-between sm:px-8">
          <p className="text-[14px] font-semibold tracking-[-0.01em]">
            Amana Protocol
          </p>
          <p className="max-w-[60ch] text-[14px] leading-normal text-sand">
            Hackathon build for the Superteam Nigeria track. Verification is
            mocked, funds live on Solana Devnet, payments run through
            Paystack test mode — no real money moves.
          </p>
        </div>
      </footer>
    </div>
  );
}
