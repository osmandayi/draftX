/**
 * Decorative top-down five-a-side pitch behind the landing hero. Pure markup +
 * CSS (see globals.css: `.pitch-*` classes and `@keyframes`). Themed for light
 * and dark; the sweep and ball animations are disabled under
 * `prefers-reduced-motion`.
 */
export function PitchBackground() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 -z-10 overflow-hidden"
    >
      {/* mown-stripe turf */}
      <div className="pitch-grass absolute inset-0" />

      {/* pitch markings (portrait, mobile-first) */}
      <svg
        className="pitch-lines absolute inset-0 h-full w-full"
        viewBox="0 0 360 640"
        preserveAspectRatio="xMidYMid slice"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
      >
        <rect x="24" y="24" width="312" height="592" rx="6" />
        <line x1="24" y1="320" x2="336" y2="320" />
        <circle cx="180" cy="320" r="56" />
        <circle cx="180" cy="320" r="3.5" fill="currentColor" stroke="none" />

        {/* top goal end */}
        <rect x="90" y="24" width="180" height="96" />
        <rect x="132" y="24" width="96" height="40" />
        <circle cx="180" cy="92" r="3" fill="currentColor" stroke="none" />
        <path d="M138 120 A 52 52 0 0 0 222 120" />

        {/* bottom goal end */}
        <rect x="90" y="520" width="180" height="96" />
        <rect x="132" y="576" width="96" height="40" />
        <circle cx="180" cy="548" r="3" fill="currentColor" stroke="none" />
        <path d="M138 520 A 52 52 0 0 1 222 520" />
      </svg>

      {/* travelling spotlight */}
      <div className="pitch-sweep absolute inset-0" />

      {/* drifting ball */}
      <div className="pitch-ball absolute">
        <svg viewBox="0 0 32 32" className="size-full">
          <circle cx="16" cy="16" r="14.5" fill="#f8fafc" stroke="#0f172a" strokeWidth="1" />
          <polygon
            points="16,10 21,13.6 19,19.5 13,19.5 11,13.6"
            fill="#0f172a"
          />
          <g stroke="#0f172a" strokeWidth="1.1">
            <line x1="16" y1="10" x2="16" y2="4" />
            <line x1="21" y1="13.6" x2="26.5" y2="11.5" />
            <line x1="19" y1="19.5" x2="23" y2="24" />
            <line x1="13" y1="19.5" x2="9" y2="24" />
            <line x1="11" y1="13.6" x2="5.5" y2="11.5" />
          </g>
        </svg>
      </div>

      {/* readability veil + fade into the page below */}
      <div className="pitch-overlay absolute inset-0" />
    </div>
  );
}
