import type { Metadata, Viewport } from "next";
import "./globals.css";

const SITE_URL = "https://amana.ayiba.dev";
const SITE_NAME = "Amana";
const TAGLINE = "Money that lives in chat";
const DESCRIPTION =
  "Amana is a custodial Solana wallet that lives in WhatsApp. Buy crypto with naira, send to any phone number or Solana address, and get a verifiable receipt for every payment.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: `${SITE_NAME} — WhatsApp wallet on Solana`,
    template: `%s — ${SITE_NAME}`,
  },
  description: DESCRIPTION,
  applicationName: SITE_NAME,
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    siteName: SITE_NAME,
    title: `${SITE_NAME} — ${TAGLINE}`,
    description: DESCRIPTION,
    url: "/",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: `${SITE_NAME} — ${TAGLINE}`,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: `${SITE_NAME} — ${TAGLINE}`,
    description: DESCRIPTION,
    images: ["/og-image.png"],
  },
  robots: { index: true, follow: true },
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
