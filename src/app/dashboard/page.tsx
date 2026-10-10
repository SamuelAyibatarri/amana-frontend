import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Image from "next/image";
import Dashboard from "@/components/Dashboard";
import { envString } from "@/lib/db";
import { getViewer } from "@/lib/gate";

export const metadata: Metadata = {
  title: "Dashboard — Amana",
  description:
    "Your Amana home base: identity status and transaction PIN setup.",
};

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  // Dashboard is for verified users only — everyone else is routed onward.
  const viewer = await getViewer();
  if (!viewer) redirect("/signin");
  if (viewer.kycStatus !== "verified") redirect("/kyc");
  return (
    <div className="on-light min-h-screen bg-pure-white text-espresso">
      <a
        href="#dashboard-main"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:rounded-[28px] focus:bg-ember-glow focus:px-5 focus:py-2 focus:text-[14px] focus:font-medium focus:text-espresso"
      >
        Skip to content
      </a>
      <header className="mx-auto flex max-w-[1200px] items-center justify-between px-4 py-6 sm:px-8">
        <a href="/" aria-label="Amana home" className="flex items-center gap-2">
          <Image src="/logo-amana-transparent.svg" alt="amana" width={88} height={22} />
        </a>
        <span className="rounded-[40px] bg-ember-wash px-3 py-1 text-[12px] font-medium text-bark">
          Wallet
        </span>
      </header>
      <main id="dashboard-main" className="mx-auto max-w-[1200px] scroll-mt-24 px-4 pt-8 pb-20 sm:px-8">
        <h1 className="sr-only">Amana dashboard</h1>
        <Dashboard botNumber={envString("WHATSAPP_BOT_NUMBER")} />
      </main>
    </div>
  );
}
