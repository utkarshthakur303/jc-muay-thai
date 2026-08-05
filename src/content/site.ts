/**
 * Business facts and page structure. Kept out of JSX so a copy change is a
 * content edit rather than a code change, and so the client can review one
 * file instead of reading components.
 *
 * Anything still awaiting the client is marked NEEDS-CLIENT and listed in
 * CLIENT-QUESTIONNAIRE.md. Nothing marked NEEDS-CLIENT is rendered as if it
 * were confirmed.
 */

export const site = {
  name: "JC Muaythai",
  shortName: "JC",
  tagline: "Unleash Your Inner Fighter",
  city: "Jersey City",
  region: "NJ",

  /**
   * IANA zone for the gym itself, not the visitor. Every "is a class on
   * right now" decision resolves against this. Deriving it from the
   * server clock would report UTC on Vercel — four to five hours out.
   */
  timeZone: "America/New_York",

  /** NEEDS-CLIENT: confirm before launch. */
  yearsEstablished: "10+",

  firstClassFree: true,
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

   Every value here came from the mockup, where it was rendered on the
   live page next to the literal word "(placeholder)". None has been
   confirmed by the client (questionnaire Q2.1–Q2.4).

   `confirmed` is the gate, and nothing reads `value` without checking
   it. An unconfirmed phone number is not a cosmetic problem: published
   as a tel: link it sends real prospective customers to a stranger, and
   published as an address it sends them to the wrong building. So the
   page renders fewer channels rather than wrong ones, and turning each
   one on is a single word here once the answer arrives.
   --------------------------------------------------------------- */

export type ContactChannel = {
  readonly kind: "email" | "phone" | "instagram" | "address";
  readonly label: string;
  readonly value: string;
  readonly confirmed: boolean;
};

export const contactChannels: readonly ContactChannel[] = [
  {
    kind: "email",
    label: "Email",
    value: "info@jcmuaythai.com",
    confirmed: false,
  },
  { kind: "phone", label: "Phone", value: "(201) 555-0134", confirmed: false },
  {
    kind: "instagram",
    label: "Instagram",
    value: "@jcmuaythai",
    confirmed: false,
  },
  {
    kind: "address",
    label: "Address",
    value: "123 Fight St, Jersey City, NJ",
    confirmed: false,
  },
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
