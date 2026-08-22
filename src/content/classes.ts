import { classSlot, type SlotId } from "@/content/imageSlots";
import {
  durationRangeForLevel,
  sessionsForLevel,
  type LevelId,
  type Session,
} from "@/content/schedule";
import type { SiteImage } from "@/lib/images/queries";

/**
 * The four classes shown in the Classes section.
 *
 * Only the prose and the photograph live here. Everything numeric — how
 * many sessions a week, how long a class runs, which days it runs on — is
 * derived from `schedule.ts` at render time, so the cards cannot drift out
 * of sync with the timetable. Prices come from `plans.ts` for the same
 * reason: one number, one place.
 *
 * ── PROVENANCE (2026-08-18) ─────────────────────────────────────────
 * The descriptions are the gym's own, from `jcmuaythai201.com/classes`,
 * rewritten into correct English at the client's instruction — their copy
 * carries typos ("sharping skills", "Set for want to be fighters") that
 * would read as ours once it sits in this typeface. Every fact is theirs:
 * bags and pads, partner work, 30 minutes of sparring, "little to no
 * fighting skills", 45-minute kids' classes. Nothing has been added.
 *
 * What was here before was plausible and invented — it described clinch
 * work and protective gear that the gym has never mentioned, and it
 * omitted the sparring, which is the single most important thing a
 * beginner needs to know about the Advanced class before booking it.
 * ────────────────────────────────────────────────────────────────────
 */

type ClassLevelContent = {
  readonly id: LevelId;
  readonly title: string;
  readonly description: string;
  /** Who the class is for, in the gym's own terms. */
  readonly suitedTo: string;
  /**
   * Null when we have no honest photograph for the class.
   *
   * That is the Kids class, and the absence is the point. The only images
   * available are of adults — stock fighters, or the gym's own photos of
   * adult sessions — and putting any of them behind a card headed "Kids"
   * tells a parent something untrue about what their child walks into.
   * The card renders on a plain surface instead, which also happens to be
   * correct: Kids is a different offering from the three graded classes,
   * and it should not look like a fourth rung on the same ladder.
   */
  readonly image: string | null;
  /**
   * Describes the photograph for a screen-reader user. Not the class name:
   * the class name is already the heading two lines above, and repeating
   * it would make the card announce itself twice.
   */
  readonly imageAlt: string | null;
};

export const classLevels: readonly ClassLevelContent[] = [
  {
    id: "beginner",
    title: "Beginners & Bag",
    description:
      "Work with a coach on the bags and on pads, learning basic stance, strikes and defensive technique.",
    suitedTo: "For people with little to no fighting experience.",
    image: "/images/beginner.jpeg",
    imageAlt: "A student drilling strikes on a heavy bag",
  },
  {
    id: "intermediate",
    title: "Intermediate",
    description:
      "Work with a partner on sharpening your striking and conditioning, and on setting up different combinations.",
    suitedTo: "For people with moderate fighting knowledge.",
    image: "/images/intermediate.jpeg",
    imageAlt: "Two training partners working Thai pads",
  },
  {
    id: "advanced",
    title: "Advanced & Fighter",
    description:
      "Cardio and skills are put to the test. Longer combinations and more defined technique, finishing with 30 minutes of sparring at the end of every class.",
    suitedTo: "For aspiring fighters and knowledgeable Muay Thai students.",
    image: "/images/advanced.jpeg",
    imageAlt: "A coach and fighter sparring in the ring",
  },
  {
    id: "kids",
    /**
     * Added 2026-08-18. The gym has run kids' classes all along — they are
     * in the timetable and always were — but the Classes section listed
     * three levels and silently left them out, so a parent reading the
     * page had no way to know the class existed.
     */
    title: "Kids",
    description:
      "Forty-five minutes designed for younger students to learn the art.",
    suitedTo: "Tuesday to Thursday after school, and Saturday afternoons.",
    image: null,
    imageAlt: null,
  },
];

/** A level's content joined with everything derived from the timetable. */
export type ClassLevel = ClassLevelContent & {
  /** "01", "02", "03" — position in the progression, not an id. */
  readonly number: string;
  readonly sessionsPerWeek: number;
  readonly duration: { min: number; max: number };
};

/**
 * Joined against a timetable and a set of photographs rather than the
 * module-level ones.
 *
 * "10 sessions a week" and "60 min" are read off whatever schedule is
 * actually in force, so an owner who moves a class sees the class cards
 * follow in the same edit. Since 2026-08-23 the same is true of the
 * pictures: `image` and `imageAlt` above are the photographs that shipped
 * with the site, and the slot overrides them when the gym has uploaded
 * one of its own.
 *
 * A slot of null keeps the card photoless — which is Kids' resting
 * state, and the whole reason the two fields were nullable to begin
 * with.
 */
export function getClassLevels(
  timetable: readonly Session[],
  slots?: Readonly<Partial<Record<SlotId, SiteImage | null>>>,
): readonly ClassLevel[] {
  return classLevels.map((level, index) => {
    // `undefined` means no opinion — use what is in this file. `null`
    // means the slot is deliberately empty, which is a different thing
    // and must not fall back to the built-in picture.
    const override = slots?.[classSlot(level.id)];
    const photo = override === undefined ? null : override;

    return {
      ...level,
      ...(slots
        ? { image: photo?.src ?? null, imageAlt: photo?.alt ?? null }
        : {}),
      number: String(index + 1).padStart(2, "0"),
      sessionsPerWeek: sessionsForLevel(timetable, level.id).length,
      duration: durationRangeForLevel(timetable, level.id),
    };
  });
}
