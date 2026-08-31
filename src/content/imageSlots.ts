import { LEVELS, type LevelId } from "@/content/schedule";

/**
 * The fixed photographic positions in the layout, and the shape each one
 * crops an uploaded picture to.
 *
 * The gallery is not here. It is a list, it is ordered, and it crops
 * nothing — the grid is CSS multi-column precisely so every photograph
 * keeps its own proportions. These are the six places where a single
 * picture sits in a box the layout decides the size of, and where
 * uploading a portrait phone photo into a wide strip loses its top and
 * its bottom.
 *
 * ── THE RATIOS ARE MEASURED ─────────────────────────────────────────
 * Off the rendered page on production, at 390px and 1440px, on
 * 2026-08-23 — not derived from the Tailwind classes, because the class
 * cards' height comes from their own copy and no amount of reading the
 * stylesheet tells you what that is.
 *
 * Two of the three change shape enough between phone and desktop that a
 * single preview would be a lie:
 *
 *   hero          0.605 phone · 0.633 desktop   — 4% apart, one preview
 *   promo         2.00  phone · 3.17  desktop   — nearly half again
 *   class cards   1.09  phone · 0.61  desktop   — landscape vs portrait
 *
 * So a slot declares every shape it really has, and the panel draws one
 * preview per shape. A class photograph that works has to survive both
 * boxes, and the only way to know that is to see both.
 * ────────────────────────────────────────────────────────────────────
 */

/** A box the photograph gets cropped to, and where that box appears. */
export type SlotShape = {
  readonly label: string;
  /** width ÷ height, as rendered. */
  readonly ratio: number;
};

export type ImageSlot = {
  readonly id: SlotId;
  /** What the owner calls it — where on the site he will look for it. */
  readonly label: string;
  /** One line under the label saying where it shows up. */
  readonly where: string;
  readonly shapes: readonly SlotShape[];
  /**
   * False for the two decorative slots.
   *
   * The hero and the promo strip sit BEHIND copy that already says
   * everything they could — the gym's name, the city, the offer. They
   * carry `alt=""` on purpose, and a screen reader skips them. Demanding
   * a description would make it announce the photograph and then read
   * the heading describing it, which is worse for the person it is meant
   * to help. Every other slot needs one, and the database enforces the
   * same split.
   */
  readonly needsAlt: boolean;
  /**
   * Shown when the slot is empty rather than pretending it is broken.
   * Only Kids has one today.
   */
  readonly emptyNote?: string;
};

const CLASS_SLOT_PREFIX = "class-" as const;

export type ClassSlotId = `${typeof CLASS_SLOT_PREFIX}${LevelId}`;
export type SlotId = "hero" | "promo" | ClassSlotId;

/** The gallery's marker in the same column. Not a slot — a collection. */
export const GALLERY_SLOT = "gallery" as const;

export function classSlot(level: LevelId): ClassSlotId {
  return `${CLASS_SLOT_PREFIX}${level}`;
}

/**
 * Phone and desktop, measured. Every class card is the same box, so they
 * share one definition rather than four copies that can drift.
 */
const CLASS_SHAPES: readonly SlotShape[] = [
  { label: "On a phone", ratio: 1.09 },
  { label: "On a desktop", ratio: 0.61 },
];

const CLASS_LABELS: Record<LevelId, string> = {
  beginner: "Beginners & Bag card",
  intermediate: "Intermediate card",
  advanced: "Advanced & Fighter card",
  kids: "Kids card",
};

export const IMAGE_SLOTS: readonly ImageSlot[] = [
  {
    id: "hero",
    label: "Hero photograph",
    where:
      "The big picture at the top of the home page, and the panel beside the sign-in and sign-up forms.",
    shapes: [{ label: "Every screen", ratio: 0.63 }],
    needsAlt: false,
  },
  {
    id: "promo",
    label: "Trial offer strip",
    where: "The wide band on the home page carrying the two-week trial.",
    shapes: [
      { label: "On a phone", ratio: 2 },
      { label: "On a desktop", ratio: 3.17 },
    ],
    needsAlt: false,
  },
  ...LEVELS.map((level) => ({
    id: classSlot(level),
    label: CLASS_LABELS[level],
    where: `Behind the ${CLASS_LABELS[level].replace(" card", "")} card in the Classes section.`,
    shapes: CLASS_SHAPES,
    needsAlt: true,
    /**
     * Kids is the one slot that SHIPPED empty, and the reason held until
     * 2026-08-31: every photograph the project had was of adults, and one
     * of those behind a card headed "Kids" tells a parent something
     * untrue about what their child walks into.
     *
     * The gym then sent a photograph with a child in it, and the client
     * asked for the card to be filled. The note below is what shows if
     * that photograph is ever removed, so it still has to make the
     * original argument.
     */
    ...(level === "kids"
      ? {
          emptyNote:
            "Empty until a real one arrives. A photograph of adults behind a card headed Kids would mislead a parent, so the card renders plain rather than borrowing one. Add a photograph of an actual kids' session and it fills.",
        }
      : {}),
  })),
];

const BY_ID = new Map(IMAGE_SLOTS.map((slot) => [slot.id as string, slot]));

export function isSlotId(value: unknown): value is SlotId {
  return typeof value === "string" && BY_ID.has(value);
}

export function slotById(id: SlotId): ImageSlot {
  const slot = BY_ID.get(id);
  // Unreachable while `SlotId` is the key type, and this is what keeps it
  // unreachable if somebody widens the type without widening the list.
  if (!slot) throw new Error(`Unknown image slot: ${id}`);
  return slot;
}

/** Every value the `slot` column accepts, including the gallery marker. */
export const ALL_SLOT_VALUES: readonly string[] = [
  GALLERY_SLOT,
  ...IMAGE_SLOTS.map((slot) => slot.id),
];
