"use client";

import { useRef } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";

gsap.registerPlugin(useGSAP);

export interface ChatScript {
  badge: string;
  opener: string;
  greeting: string;
  request: string;
  receiptTitle: string;
  receiptLines: string[];
  receiptMeta: string;
  times: [string, string, string, string];
  ariaLabel: string;
}

function Ticks() {
  return (
    <svg
      aria-hidden
      width="16"
      height="11"
      viewBox="0 0 16 11"
      fill="none"
      className="shrink-0"
    >
      <path
        d="M11.07 1.5 5.9 6.67 3.83 4.6l-.71.71 2.78 2.77 5.88-5.87-.71-.71Z"
        fill="#b53f00"
      />
      <path
        d="M15.07 1.5 9.9 6.67l-.71-.71 5.17-5.17.71.71Z"
        fill="#b53f00"
      />
    </svg>
  );
}

function TypingDots() {
  return (
    <span aria-hidden className="flex items-center gap-1 py-1" role="presentation">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="typing-dot block h-2 w-2 rounded-full bg-taupe"
          style={{ animationDelay: `${i * 0.18}s` }}
        />
      ))}
    </span>
  );
}

function Time({ value, outgoing = false }: { value: string; outgoing?: boolean }) {
  return (
    <span className="ml-2 inline-flex items-center gap-1 align-bottom text-[11px] text-taupe">
      {value}
      {outgoing && <Ticks />}
    </span>
  );
}

/**
 * One looping chat demo. Same 4-beat script shape for every card
 * (user → bot → user → receipt); content comes from the script prop.
 * Reduced-motion and no-JS users get the full script statically;
 * assistive tech gets a single labelled image.
 */
export default function ChatDemoCard({ script }: { script: ChatScript }) {
  const root = useRef<HTMLDivElement>(null);
  const tlRef = useRef<gsap.core.Timeline | null>(null);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        const show = { autoAlpha: 1, y: 0, duration: 0.35, ease: "power2.out" };
        const hide = { autoAlpha: 0, duration: 0.2 };
        const tl = gsap.timeline({ repeat: -1, repeatDelay: 1.4 });
        tlRef.current = tl;
        tl.fromTo(".wa-typing-1", { autoAlpha: 0, y: 8 }, { autoAlpha: 1, y: 0, duration: 0.3 })
          .to(".wa-typing-1", hide, "+=0.9")
          .fromTo(".wa-msg-1", { autoAlpha: 0, y: 12 }, show, "<")
          .fromTo(".wa-typing-2", { autoAlpha: 0, y: 8 }, { autoAlpha: 1, y: 0, duration: 0.3 }, "+=0.5")
          .to(".wa-typing-2", hide, "+=1.2")
          .fromTo(".wa-msg-2", { autoAlpha: 0, y: 12 }, show, "<")
          .fromTo(".wa-msg-3", { autoAlpha: 0, y: 12 }, show, "+=0.7")
          .fromTo(".wa-typing-4", { autoAlpha: 0, y: 8 }, { autoAlpha: 1, y: 0, duration: 0.3 }, "+=0.4")
          .to(".wa-typing-4", hide, "+=1.3")
          .fromTo(".wa-msg-4", { autoAlpha: 0, y: 12 }, show, "<")
          .to(".wa-fade", { autoAlpha: 0, duration: 0.4 }, "+=2.8");
      });
    },
    { scope: root },
  );

  return (
    <div
      ref={root}
      role="img"
      aria-label={script.ariaLabel}
      onMouseEnter={() => tlRef.current?.pause()}
      onMouseLeave={() => tlRef.current?.play()}
      className="hero-mockup demo-lift relative w-full max-w-[360px] overflow-hidden rounded-2xl border border-espresso bg-warm-bone text-espresso shadow-[0_24px_60px_rgba(0,0,0,0.35),0_4px_12px_rgba(0,0,0,0.2)]"
    >
      <div aria-hidden>
        {/* Header */}
        <div className="flex items-center gap-3 border-b border-espresso/10 bg-pure-white px-4 py-3">
          <span className="text-[20px] leading-none text-taupe">‹</span>
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-ember-glow text-[15px] font-bold text-espresso">
            A
          </span>
          <span className="flex min-w-0 flex-col">
            <span className="truncate text-[15px] font-semibold">
              Amana Bot
            </span>
            <span className="inline-flex items-center gap-1 text-[12px] text-deep-ember">
              <span className="h-1.5 w-1.5 rounded-full bg-deep-ember" />
              online
            </span>
          </span>
          <span className="ml-auto rounded-[20px] bg-ember-wash px-3 py-1 text-[12px] font-medium text-bark">
            {script.badge}
          </span>
        </div>

        {/* Chat body */}
        <div className="wa-chat flex min-h-[340px] flex-col gap-2 px-4 py-5">
          <div className="wa-fade wa-typing-1 self-start rounded-2xl rounded-tl-md border border-espresso/15 bg-pure-white px-3">
            <TypingDots />
          </div>
          <div className="wa-fade wa-msg-1 max-w-[80%] self-end rounded-2xl rounded-tr-md bg-bark px-3 py-2 text-[14px] leading-snug text-pure-white">
            {script.opener}
            <Time value={script.times[0]} outgoing />
          </div>

          <div className="wa-fade wa-typing-2 self-start rounded-2xl rounded-tl-md border border-espresso/15 bg-pure-white px-3">
            <TypingDots />
          </div>
          <div className="wa-fade wa-msg-2 max-w-[85%] self-start rounded-2xl rounded-tl-md border border-espresso/15 bg-pure-white px-3 py-2 text-[14px] leading-snug">
            {script.greeting}
            <Time value={script.times[1]} />
          </div>

          <div className="wa-fade wa-msg-3 max-w-[80%] self-end rounded-2xl rounded-tr-md bg-bark px-3 py-2 text-[14px] leading-snug text-pure-white">
            {script.request}
            <Time value={script.times[2]} outgoing />
          </div>

          <div className="wa-fade wa-typing-4 self-start rounded-2xl rounded-tl-md border border-espresso/15 bg-pure-white px-3">
            <TypingDots />
          </div>
          <div className="wa-fade wa-msg-4 max-w-[85%] self-start rounded-2xl rounded-tl-md border border-bark bg-pure-white px-3 py-2">
            <p className="text-[15px] font-semibold">{script.receiptTitle}</p>
            {script.receiptLines.map((line) => (
              <p key={line} className="mt-0.5 text-[13px] text-bark">
                {line}
              </p>
            ))}
            <p className="mt-1 text-[12px] text-taupe">
              {script.receiptMeta}
              <Time value={script.times[3]} />
            </p>
          </div>
        </div>

        {/* Input bar */}
        <div className="flex items-center gap-2 border-t border-espresso/10 bg-pure-white px-3 py-2">
          <div className="flex-1 rounded-full border border-espresso/15 bg-warm-bone px-4 py-2 text-[14px] text-taupe">
            Message
          </div>
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-ember-glow">
            <svg aria-hidden width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path
                d="M15 1 7 9M15 1l-4.5 13-2.8-5.2L2.5 5 15 1Z"
                stroke="#2a2118"
                strokeWidth="1.6"
                strokeLinejoin="round"
              />
            </svg>
          </span>
        </div>
      </div>
    </div>
  );
}
