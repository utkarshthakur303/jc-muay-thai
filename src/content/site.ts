/**
 * Business facts and page structure. Kept out of JSX so a copy change is a
 * content edit rather than a code change, and so the client can review one
 * file instead of reading components.
 *
 * ── PROVENANCE (2026-08-18) ─────────────────────────────────────────
 * The facts below now come from the gym's own live site,
 * `jcmuaythai201.com`, saved in the repo root as `old.html`. Until that
 * arrived, every contact channel here was a mockup placeholder — rendered
 * on the design next to the literal word "(placeholder)" — and every one
 * was therefore withheld from the page rather than published.
 *
 * They are published now because they are real, and each is sourced below.
 * `confirmed` stays as the gate: it is what the page reads, so a channel
 * we stop being sure about goes back to being withheld by editing one
 * word, not by hunting through components.
 * ────────────────────────────────────────────────────────────────────
 */

export const site = {
  /**
   * Three words, as the gym writes it — on their site, their signage,
   * their domain and their Instagram handle. This was "JC Muaythai" while
   * it came from the mockup.
   */
  name: "JC Muay Thai",
  shortName: "JC",

  /**
   * The mockup's line, kept deliberately. Their own strapline is
   * "Empowering Minds & Bodies Through the Art of Muay Thai" — put to the
   * client on 2026-08-18, who chose to keep this one. A strapline is a
   * design decision, not a fact about the business, so there is nothing
   * here to get wrong.
   */
  tagline: "Unleash Your Inner Fighter",
  city: "Jersey City",
  region: "NJ",

  /**
   * IANA zone for the gym itself, not the visitor. Every "is a class on
   * right now" decision resolves against this. Deriving it from the
   * server clock would report UTC on Vercel — four to five hours out.
   */
  timeZone: "America/New_York",

  /**
   * Confirmed by the client 2026-08-18. It appears nowhere on their old
   * site, so it was flagged as invented and put back to them directly;
   * they confirmed it is accurate and simply had never been written down.
   */
  yearsEstablished: "10+",
} as const;

/* ---------------------------------------------------------------
   THE NEWCOMER OFFER

   This used to be "your first class is free", and that was invented. It
   ran in four places — the hero, the promo tile, the contact heading and
   the site's search-engine description — which is to say the site was
   making an offer on the gym's behalf, to the public, in the place a
   first-time visitor decides on.

   The real offer is on the old site's classes page, in their words:
   "Two-Week Trial: Perfect for newcomers, this option allows you to
   experience training without a long-term commitment."

   What it costs is NOT stated there, and the client's instruction was to
   say nothing about the cost rather than guess at "free". So the copy
   describes the commitment, which is the part we know, and the price
   conversation happens at the desk — which is where this gym takes money
   anyway.
   --------------------------------------------------------------- */

export const trialOffer = {
  name: "Two-week trial",
  /** The button, everywhere it appears. The client's own wording. */
  cta: "Book your trial class now",
  blurb:
    "Train for two weeks before committing to anything — no contract and no minimum.",
} as const;

/**
 * Sections rendered on the home page, in document order.
 *
 * This array is the nav. Both the desktop rail and the mobile bar map over
 * it, and the active-section observer watches exactly these ids — so
 * shipping a new section is one entry here plus the section itself, and it
 * is impossible to have a nav link pointing at a section that does not
 * exist.
 *
 * `short` is what the mobile bar shows. Six equal-width items have to fit
 * inside a 360px phone, which leaves roughly 45px of label each: "Schedule"
 * does not fit and "Times" does. Both labels are declared here rather than
 * one being computed or hardcoded in the bar, so the two can never drift.
 *
 * Shop is in the approved mockup and is deliberately absent — nothing on
 * this site can take a payment, and Q3.3 of the client questionnaire has
 * not come back. A rail advertising a shop that cannot sell is worse than
 * one that does not mention it.
 */
export const navSections = [
  { id: "home", label: "Home", short: "Home", icon: "home" },
  { id: "classes", label: "Classes", short: "Classes", icon: "classes" },
  { id: "schedule", label: "Schedule", short: "Times", icon: "schedule" },
  { id: "gallery", label: "Gallery", short: "Photos", icon: "gallery" },
  { id: "contact", label: "Contact", short: "Contact", icon: "contact" },
] as const;

export type NavSection = (typeof navSections)[number];
export type SectionId = NavSection["id"];

export const sectionIds: readonly SectionId[] = navSections.map((s) => s.id);

/* ---------------------------------------------------------------
   PUBLIC CONTACT CHANNELS

   All four are now the gym's real ones, taken from the footer and header
   of their live site. Before 2026-08-18 all four were mockup placeholders
   and all four were therefore withheld — the site gave a visitor no way
   to phone the gym at all, which was the correct trade but a bad page.

   `confirmed` is still the gate, and nothing reads `value` without
   checking it. A wrong phone number is not a cosmetic problem: as a tel:
   link it sends real prospective customers to a stranger's handset, and a
   wrong address sends them to someone else's front door. A gym gets one
   chance with a first-time visitor.
   --------------------------------------------------------------- */

export type ContactChannel = {
  readonly kind: "email" | "phone" | "instagram" | "address";
  readonly label: string;
  readonly value: string;
  readonly confirmed: boolean;
};

export const contactChannels: readonly ContactChannel[] = [
  {
    kind: "phone",
    label: "Phone",
    // Header and footer of jcmuaythai201.com.
    value: "(551) 353-6875",
    confirmed: true,
  },
  {
    kind: "email",
    label: "Email",
    /**
     * The address the gym already publishes, and already receives
     * enquiries on. Deliberately NOT the jcmuaythaiofficial@ account that
     * owns the admin panel here — see `alertsEmail` below. The client
     * chose to keep the two apart on 2026-08-18.
     */
    value: "jcmuaythai201@gmail.com",
    confirmed: true,
  },
  {
    kind: "instagram",
    label: "Instagram",
    // instagram.com/jc_muay_thai, linked from their site's header.
    value: "@jc_muay_thai",
    confirmed: true,
  },
  {
    kind: "address",
    label: "Address",
    /**
     * Rendered as plain text, not a map link. Their site does link a
     * Google Maps listing from the footer, and the client's instruction
     * on 2026-08-18 was to leave the address unlinked — so `channelHref`
     * returns null for this kind and that is intentional, not a gap.
     */
    value: "3487 Kennedy Blvd, Jersey City, NJ 07307",
    confirmed: true,
  },
];

/**
 * Where the gym's own alerts go — cancellation notices, enquiry
 * notifications. Distinct from the public email above on purpose: the
 * client wanted visitors writing to the address they already watch, and
 * the system writing to the account that owns the admin panel.
 *
 * Not a contact channel, so deliberately not in the list above. Nothing
 * should ever render this on a public page.
 */
export const alertsEmail = "jcmuaythaiofficial@gmail.com";

/* ---------------------------------------------------------------
   OPENING HOURS

   From the footer of the old site, and a fact the new site did not carry
   at all. A timetable is not a substitute: knowing there is an 11 AM
   class tells a visitor nothing about whether they can walk in at 2 PM to
   ask a question.

   These are also load-bearing. `schedule.ts` asserts at build time that
   every class falls inside the day's opening window — which is exactly
   the check that would have caught the invented Friday evening classes
   before they ever reached the page.
   --------------------------------------------------------------- */

export type OpeningDay = {
  /** Matches `DayId` in schedule.ts, plus "sun", which has no classes. */
  readonly day: "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";
  /** 24-hour "HH:MM", gym-local. Null on both when the gym is shut. */
  readonly opens: string | null;
  readonly closes: string | null;
};

/**
 * Day names for the hours, short and long.
 *
 * Declared here rather than reused from schedule.ts because that file's
 * `DayId` deliberately has no Sunday — the gym runs no classes then — and
 * a closed day still needs a row. Importing the other direction would
 * also be a cycle: schedule.ts already imports this file to assert that
 * no class runs outside these hours.
 */
export const OPENING_DAY_LABELS: Record<
  OpeningDay["day"],
  { readonly short: string; readonly long: string }
> = {
  mon: { short: "Mon", long: "Monday" },
  tue: { short: "Tue", long: "Tuesday" },
  wed: { short: "Wed", long: "Wednesday" },
  thu: { short: "Thu", long: "Thursday" },
  fri: { short: "Fri", long: "Friday" },
  sat: { short: "Sat", long: "Saturday" },
  sun: { short: "Sun", long: "Sunday" },
};

export const openingHours: readonly OpeningDay[] = [
  { day: "mon", opens: "09:00", closes: "20:30" },
  { day: "tue", opens: "09:00", closes: "20:30" },
  { day: "wed", opens: "09:00", closes: "20:30" },
  { day: "thu", opens: "09:00", closes: "20:30" },
  { day: "fri", opens: "09:00", closes: "13:30" },
  { day: "sat", opens: "09:00", closes: "18:30" },
  { day: "sun", opens: null, closes: null },
];

export const confirmedChannels: readonly ContactChannel[] =
  contactChannels.filter((channel) => channel.confirmed);

/** `tel:`/`mailto:`/`https:` target for a channel, or null if it is not linkable. */
export function channelHref(channel: ContactChannel): string | null {
  switch (channel.kind) {
    case "email":
      return `mailto:${channel.value}`;
    case "phone":
      // Strip everything a dialler cannot use. "(201) 555-0134" must reach
      // the handset as +12015550134 or iOS quietly refuses the link.
      return `tel:+1${channel.value.replace(/\D/g, "")}`;
    case "instagram":
      return `https://instagram.com/${channel.value.replace(/^@/, "")}`;
    case "address":
      // An address is not a link. Mapping it needs a confirmed street
      // address and a decision on which map provider (Q2.8).
      return null;
  }
}
