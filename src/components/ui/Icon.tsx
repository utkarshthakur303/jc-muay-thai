/**
 * Icon set.
 *
 * Every path is stroked with `currentColor`. The mockup shipped icons as
 * HTML strings and recoloured them with `.replace(/CLR/g, colour)` before
 * injecting them via dangerouslySetInnerHTML — which put colour decisions
 * in JavaScript, bypassed the theme tokens entirely, and meant an icon
 * could not respond to :hover or a scoped theme override. With
 * currentColor, colour comes from CSS like everything else, and a parent
 * `text-*` utility drives it.
 */

export type IconName =
  | "home"
  | "classes"
  | "schedule"
  | "gallery"
  | "contact"
  | "calendar"
  | "sun"
  | "moon"
  | "pause"
  | "play"
  | "arrow-right"
  | "user";

const PATHS: Record<IconName, React.ReactNode> = {
  home: (
    <>
      <path d="M4 11l8-7 8 7" />
      <path d="M6 10v9a1 1 0 0 0 1 1h3v-6h4v6h3a1 1 0 0 0 1-1v-9" />
    </>
  ),
  classes: (
    <>
      <rect x="4" y="4" width="7" height="7" rx="1.5" />
      <rect x="13" y="4" width="7" height="7" rx="1.5" />
      <rect x="4" y="13" width="7" height="7" rx="1.5" />
      <rect x="13" y="13" width="7" height="7" rx="1.5" />
    </>
  ),
  /**
   * A ruled grid, not a calendar. The Schedule tab and the "book a class"
   * button sit within 300px of each other in the rail; giving both a
   * calendar would make the only difference between them the label, which
   * defeats the point of having icons.
   */
  schedule: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M3 9.5h18M3 14.5h18M9 9.5V19" />
    </>
  ),
  gallery: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <circle cx="8.5" cy="9.5" r="1.5" />
      <path d="M3.5 16.5 8 12.5l3.5 3 3-2.5 5.5 4.5" />
    </>
  ),
  contact: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="m3.6 7 8.4 6 8.4-6" />
    </>
  ),
  calendar: (
    <>
      <rect x="4" y="5" width="16" height="16" rx="3" />
      <path d="M4 10h16M8 3v4M16 3v4" />
    </>
  ),
  sun: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1" />
    </>
  ),
  moon: <path d="M20 14.5A8.5 8.5 0 1 1 9.5 4a7 7 0 0 0 10.5 10.5Z" />,
  pause: (
    <>
      <path d="M9.5 5v14M14.5 5v14" />
    </>
  ),
  play: <path d="M8 5.2v13.6L19 12 8 5.2Z" />,
  "arrow-right": <path d="M5 12h14M13 6l6 6-6 6" />,
  user: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M5 21a7 7 0 0 1 14 0" />
    </>
  ),
};

type IconProps = {
  name: IconName;
  /** Pixels. Matches the 24-unit viewBox 1:1 at 24. */
  size?: number;
  className?: string;
};

export function Icon({ name, size = 20, className }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      // Icons here are always paired with visible text, so they are
      // decorative and must not be announced. focusable="false" stops
      // legacy Edge/IE from putting SVGs in the tab order.
      aria-hidden
      focusable="false"
      className={className}
    >
      {PATHS[name]}
    </svg>
  );
}

/** The brand mark: a clock face, for a gym that runs on the round timer. */
export function LogoMark({
  size = 22,
  className,
}: {
  size?: number;
  className?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      aria-hidden
      focusable="false"
      className={className}
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M12 5 L12 12 L16 15" strokeLinecap="round" />
    </svg>
  );
}
