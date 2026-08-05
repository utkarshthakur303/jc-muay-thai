import {
  durationRangeForLevel,
  sessionsForLevel,
  type LevelId,
} from "@/content/schedule";

/**
 * The three levels shown in the Classes section.
 *
 * Only the prose and the photograph live here. Everything numeric — how
 * many sessions a week, how long a class runs, which days it runs on — is
 * derived from `schedule.ts` at render time, so the cards cannot drift out
 * of sync with the timetable.
 */

type ClassLevelContent = {
  readonly id: Extract<LevelId, "beginner" | "intermediate" | "advanced">;
  readonly title: string;
  readonly description: string;
  readonly image: string;
  /**
   * Describes the photograph for a screen-reader user. Not the class name:
   * the class name is already the heading two lines above, and repeating
   * it would make the card announce itself twice.
   */
  readonly imageAlt: string;
};

export const classLevels: readonly ClassLevelContent[] = [
  {
    id: "beginner",
    title: "Beginners",
    description:
      "Work on heavy bags under the guidance of an experienced coach, or train with a partner using focus pads to improve your technique, build your skills, and raise your cardiovascular fitness. Ideal for anyone with little or no previous experience in combat sports.",
    image: "/images/beginner.jpeg",
    imageAlt: "A student drilling strikes on a heavy bag",
  },
  {
    id: "intermediate",
    title: "Intermediate",
    description:
      "Train primarily with a partner using Thai pads and protective gear while learning authentic Muay Thai technique. Develop punches, kicks, knees, elbows and clinch work in a safe, supervised environment.",
    image: "/images/intermediate.jpeg",
    imageAlt: "Two training partners working Thai pads",
  },
  {
    id: "advanced",
    title: "Advanced",
    description:
      "Push your cardio and endurance further, finishing each session with sparring rounds. Refine advanced combinations while developing precision, timing and fight strategy. Best suited to experienced students and those preparing for competition.",
    image: "/images/advanced.jpeg",
    imageAlt: "A coach and fighter sparring in the ring",
  },
];

/** A level's content joined with everything derived from the timetable. */
export type ClassLevel = ClassLevelContent & {
  /** "01", "02", "03" — position in the progression, not an id. */
  readonly number: string;
  readonly sessionsPerWeek: number;
  readonly duration: { min: number; max: number };
};

export function getClassLevels(): readonly ClassLevel[] {
  return classLevels.map((level, index) => ({
    ...level,
    number: String(index + 1).padStart(2, "0"),
    sessionsPerWeek: sessionsForLevel(level.id).length,
    duration: durationRangeForLevel(level.id),
  }));
}
