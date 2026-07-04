/**
 * Per-captain accent colors so the two sides are easy to tell apart:
 * Captain A = green, Captain B = orange. Classes are full literals so Tailwind
 * detects them. Used by CaptainTag, TeamPanel and DraftBoard.
 */
export interface CaptainColor {
  /** Slot label + inline accents (text). */
  text: string;
  /** Small round indicator. */
  dot: string;
  /** Avatar ring. */
  ring: string;
  /** Panel border when this captain is on the clock. */
  border: string;
  /** Panel ring when on the clock. */
  panelRing: string;
  /** "On the clock" pill (background + text). */
  badge: string;
  /** Hover accent for interactive pickable items (border + bg). */
  hover: string;
}

export const CAPTAIN_COLORS: Record<"A" | "B", CaptainColor> = {
  A: {
    text: "text-emerald-600 dark:text-emerald-400",
    dot: "bg-emerald-500",
    ring: "ring-emerald-500/60",
    border: "border-emerald-500",
    panelRing: "ring-emerald-500/40",
    badge: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
    hover: "hover:border-emerald-500 hover:bg-emerald-500/10",
  },
  B: {
    text: "text-orange-600 dark:text-orange-400",
    dot: "bg-orange-500",
    ring: "ring-orange-500/60",
    border: "border-orange-500",
    panelRing: "ring-orange-500/40",
    badge: "bg-orange-500/15 text-orange-600 dark:text-orange-400",
    hover: "hover:border-orange-500 hover:bg-orange-500/10",
  },
};
