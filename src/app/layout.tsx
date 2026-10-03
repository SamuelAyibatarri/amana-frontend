import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Amana — WhatsApp wallet on Solana",
  description:
    "Amana is a custodial Solana wallet that lives in WhatsApp. Buy, send, and cash out from chat. Mock KYC for the hackathon.",
};

export const viewport: Viewport = {
  themeColor: "#161009",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="icon" href="/favicon.svg" type="image/svg+xml"></link>
      </head>
      <body className="bg-ember-night text-pure-white antialiased">
        {children}
      </body>
    </html>
  );
}
