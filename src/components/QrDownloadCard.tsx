"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";

/** WhatsApp deep link for the bot line (E.164 without +). */
const WA_LINK = "https://wa.me/2348088848220";

export default function QrDownloadCard() {
  const [qr, setQr] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    QRCode.toString(WA_LINK, { type: "svg", margin: 1, width: 220 }).then(
      (svg) => {
        if (live) {
          setQr(
            `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svg)))}`,
          );
        }
      },
    ).catch(() => {
      // QR stays empty — the card copy still carries the link.
    });
    return () => {
      live = false;
    };
  }, []);

  return (
    <div className="overflow-hidden rounded-[20px] border border-espresso bg-warm-bone text-espresso">
      <div className="grid grid-cols-1 sm:grid-cols-2">
        <div className="flex items-center justify-center bg-pure-white p-6">
          {qr ? (
            <img
              src={qr}
              alt="QR code — scan to chat with Amana on WhatsApp"
              width={220}
              height={220}
              className="w-full"
              style={{ maxWidth: 220 }}
            />
          ) : (
            <div
              role="img"
              aria-label="QR code loading"
              className="w-full animate-pulse bg-warm-bone"
              style={{ maxWidth: 220, aspectRatio: "1" }}
            />
          )}
        </div>
        <div className="flex min-w-0 flex-col items-start justify-center gap-4 p-6 sm:p-8">
          <p className="text-[24px] leading-[1.33] font-semibold tracking-[-0.015em]">
            Same wallet, bigger screen.
          </p>
          <p className="max-w-[48ch] text-[16px] leading-[1.5]">
            Amana lives in your chat. Scan to open the bot on WhatsApp, or
            keep going here — the balance follows you either way.
          </p>
          <a
            href={WA_LINK}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-[28px] bg-espresso px-5 py-2 text-[14px] font-medium text-pure-white transition-colors hover:bg-ember-glow hover:text-espresso"
          >
            Chat with Amana
          </a>
          <p className="font-instrument-serif text-[16px] text-taupe italic">
            one wallet, two doors
          </p>
        </div>
      </div>
    </div>
  );
}
