import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Image from "next/image";
import SignInForm from "@/components/SignInForm";
import { getViewer } from "@/lib/gate";

export const metadata: Metadata = {
  title: "Sign in — Amana",
  description:
    "Sign in to Amana with your WhatsApp number. Get a magic link, tap it, verify identity.",
};

export const dynamic = "force-dynamic";

export default async function SignInPage() {
  // Signed-in users never see the form — onward by verification state.
  const viewer = await getViewer();
  if (viewer) redirect(viewer.kycStatus === "verified" ? "/dashboard" : "/kyc");
  return (
    <div className="on-light min-h-screen bg-pure-white text-espresso">
      <a
        href="#signin-main"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:rounded-[28px] focus:bg-ember-glow focus:px-5 focus:py-2 focus:text-[14px] focus:font-medium focus:text-espresso"
      >
        Skip to content
      </a>
      <header className="mx-auto flex max-w-[1200px] items-center justify-between px-4 py-6 sm:px-8">
        <a href="/" aria-label="Amana home" className="flex items-center gap-2">
          <Image src="/logo-amana-transparent.svg" alt="amana" width={88} height={22} />
        </a>
        <span className="rounded-[40px] bg-ember-wash px-3 py-1 text-[12px] font-medium text-bark">
          Secure sign-in
        </span>
      </header>
      <main id="signin-main" className="mx-auto max-w-[640px] scroll-mt-24 px-4 pt-8 pb-20 sm:px-8">
        <p className="font-instrument-serif text-[18px] text-taupe italic">
          no passwords, no seed phrases
        </p>
        <h1 className="mt-4 text-[32px] leading-[1.2] font-semibold tracking-[-0.021em] text-balance">
          Sign in
        </h1>
        <p className="mt-4 max-w-[52ch] text-[16px] leading-[1.5]">
          Enter the WhatsApp number the bot knows you by. You’ll get a
          sign-in link in your WhatsApp — tap it and you’re in, on this
          device.
        </p>
        <div className="mt-8 rounded-[20px] border border-espresso bg-warm-bone p-6 sm:p-8">
          <SignInForm />
        </div>
      </main>
    </div>
  );
}
