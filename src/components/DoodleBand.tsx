/**
 * Crypto doodle band — WhatsApp-wallpaper-style tiled glyphs for dark
 * sections. Static SVG pattern (no animation, no cost). Sand strokes at
 * low opacity on transparent; the parent supplies the Ember Night band.
 */
const GLYPHS = [
  // coin
  '<g fill="none" stroke="STROKE" stroke-width="1.5"><circle cx="12" cy="12" r="8"/><path d="M8.5 12h7M12 8.5v7"/></g>',
  // key
  '<g fill="none" stroke="STROKE" stroke-width="1.5"><circle cx="8" cy="8" r="4.5"/><path d="M11.5 11.5 20 20M16.5 16.5l2.5-2.5"/></g>',
  // chat bubble
  '<g fill="none" stroke="STROKE" stroke-width="1.5"><path d="M4 5h16v11H9.5L4 20V5z"/><circle cx="9" cy="10.5" r="0.8" fill="STROKE"/><circle cx="13" cy="10.5" r="0.8" fill="STROKE"/></g>',
  // arrow up-right
  '<g fill="none" stroke="STROKE" stroke-width="1.5"><path d="M7 17 17 7M8.5 7H17v8.5"/></g>',
  // bolt
  '<g fill="none" stroke="STROKE" stroke-width="1.5" stroke-linejoin="round"><path d="M13 2 4.5 13.5H11L10 22l8.5-11.5H12L13 2z"/></g>',
  // naira-ish double-bar mark
  '<g fill="none" stroke="STROKE" stroke-width="1.5"><path d="M7 4v16M17 4v16M7 8h10M7 16h10"/></g>',
] as const;

function tile(): string {
  const cells = GLYPHS.map((g, i) => {
    const x = (i % 3) * 56 + 8;
    const y = Math.floor(i / 3) * 56 + 8;
    const rotate =
      i % 2 === 0 ? ` rotate(${(i * 17) % 30 - 15} 12 12)` : "";
    return `<g transform="translate(${x} ${y}) scale(1.15)" opacity="0.55"><g transform="${rotate}">${g.replaceAll("STROKE", "#C4B49A")}</g></g>`;
  }).join("");
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="176" height="120">` +
    cells +
    `</svg>`
  );
}

let cached: string | null = null;

function dataUrl(): string {
  if (!cached) {
    // btoa path (no Buffer in browser bundles) — UTF-8 safe via encodeURIComponent.
    cached = `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(tile())))}`;
  }
  return cached;
}

export default function DoodleBand({ opacity = 0.16 }: { opacity?: number }) {
  const src = dataUrl();
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0"
      style={{
        backgroundImage: `url("${src}")`,
        backgroundSize: "176px 120px",
        opacity,
        maskImage:
          "radial-gradient(ellipse 90% 80% at 50% 40%, black 30%, transparent 75%)",
        WebkitMaskImage:
          "radial-gradient(ellipse 90% 80% at 50% 40%, black 30%, transparent 75%)",
      }}
    />
  );
}
