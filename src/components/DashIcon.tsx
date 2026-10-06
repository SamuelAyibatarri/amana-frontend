/**
 * Dashboard icons: inline SVG, currentColor strokes, no emoji, no deps.
 * 24x24 viewBox, 2px rounded strokes — quiet Ember geometry.
 */

export type DashIconName = "home" | "activity" | "security" | "settings" | "left" | "right";

const PATHS: Record<DashIconName, React.ReactNode> = {
  home: (
    <path d="M4 11.5 12 4l8 7.5M6.5 10v9.5h11V10" />
  ),
  activity: (
    <>
      <path d="M7 4h10v16H7z" />
      <path d="M10 9h4M10 12.5h4M10 16h2.5" />
    </>
  ),
  security: (
    <>
      <rect x="6.5" y="10.5" width="11" height="9" rx="2" />
      <path d="M9 10.5V8a3 3 0 0 1 6 0v2.5" />
    </>
  ),
  settings: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 3.5v2.5M12 18v2.5M3.5 12H6M18 12h2.5M6 6l1.8 1.8M16.2 16.2 18 18M18 6l-1.8 1.8M7.8 16.2 6 18" />
    </>
  ),
  left: <path d="M14.5 5.5 8 12l6.5 6.5" />,
  right: <path d="M9.5 5.5 16 12l-6.5 6.5" />,
};

export default function DashIcon({
  name,
  size = 20,
}: {
  name: DashIconName;
  size?: number;
}) {
  return (
    <svg
      aria-hidden="true"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      focusable="false"
    >
      {PATHS[name]}
    </svg>
  );
}
