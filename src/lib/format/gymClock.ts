/**
 * Reading the clock *at the gym*, from anywhere in the world.
 *
 * Two components need this — the live "class on now" line on the home page
 * and the "today" summary above the schedule — so it lives here rather
 * than being written twice with a chance of drifting.
 *
 * Everything below is client-side by necessity. `new Date()` on the server
 * is the server's clock, which on Vercel is UTC: the mockup's identical
 * check would have told a visitor a class was running at four in the
 * morning, Jersey City time. Reading the clock during render would also
 * make the page dynamic, costing the static prerender that lets the home
 * page be served straight from the CDN.
 */

/** Sunday-first, matching Date's own weekday indexing. */
export const WEEK = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;
export type WeekdayId = (typeof WEEK)[number];

export type GymClock = {
  weekday: WeekdayId;
  /** 0 = Sunday, matching the WEEK array. */
  weekdayIndex: number;
  /** Minutes since midnight, gym-local. */
  minutes: number;
};

/**
 * Intl is the whole implementation on purpose: it is the only way to get
 * another zone's wall-clock time that stays correct across a daylight
 * saving transition. A fixed UTC-5 offset is right for four months of the
 * year and an hour out for the other eight.
 */
export function gymNow(timeZone: string): GymClock {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    // h23 rather than hour12:false — the latter renders midnight as "24"
    // in some ICU builds, which would put the gym an entire day off.
    hourCycle: "h23",
  }).formatToParts(new Date());

  const read = (type: Intl.DateTimeFormatPartTypes): string =>
    parts.find((part) => part.type === type)?.value ?? "";

  const name = read("weekday").toLowerCase().slice(0, 3);
  const index = WEEK.indexOf(name as WeekdayId);

  // Falling back to Sunday rather than throwing: a wrong day would be a
  // visible bug, but an exception here would take down a whole section of
  // the page over a formatting quirk. Sunday has no classes, so the
  // fallback degrades to "no classes today" — visibly conservative.
  const weekdayIndex = index === -1 ? 0 : index;

  return {
    weekday: WEEK[weekdayIndex] ?? "sun",
    weekdayIndex,
    minutes: Number(read("hour")) * 60 + Number(read("minute")),
  };
}
