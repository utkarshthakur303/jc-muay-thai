import { Section } from "@/components/layout/Section";
import { OpeningHours } from "@/components/schedule/OpeningHours";
import { DayCard } from "@/components/schedule/DayCard";
import { TodayAtTheGym } from "@/components/schedule/TodayAtTheGym";
import { DAYS, totalWeeklySessions } from "@/content/schedule";
import type { TimetableEntry } from "@/lib/schedule/queries";

/**
 * The full weekly timetable.
 *
 * Two things from the mockup are gone, and one is rebuilt differently.
 *
 * The scrolling marquee is gone, and so is the sentence it carried. It
 * said the schedule varies over the summer, which sounded like the gym
 * talking and was not — nothing on the real site claims it. Removed with
 * the rest of the invented copy on 2026-08-18. What sits here instead is
 * the gym's actual opening hours, which is a fact, and the more useful
 * one: a class at 11 AM tells you nothing about whether the door is open
 * at 2 PM.
 *
 * The clickable rows are gone. They opened a drawer that listed times and
 * showed a hardcoded "3 spots left" next to a button that booked nothing.
 * There is no honest version of that control until capacity exists
 * (questionnaire Q4.1), so the rows are not pretending to be interactive.
 *
 * And the table itself is now a grid of days. A six-by-five table cannot
 * fit a phone — the tightest honest rendering still needs about 640px, so
 * on the majority of this site's traffic it becomes a sideways-scrolling
 * region, which is the worst way to read a timetable. Days as cards fit
 * every width, and the axis a table would have been better at — one level
 * across the whole week — is already covered by the class cards above,
 * each of which lists its own days and times.
 */
export function ScheduleSection({
  timetable,
}: {
  timetable: readonly TimetableEntry[];
}) {
  return (
    <Section
      id="schedule"
      title="SCHEDULE"
      meta={`${totalWeeklySessions(timetable)} sessions · Mon–Sat`}
      intro="The same three graded classes run back to back every morning, Monday to Saturday, and again on weekday evenings. Kids' classes run after school and are listed alongside them."
    >
      <TodayAtTheGym timetable={timetable} />

      <OpeningHours />

      <ul
        role="list"
        className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
      >
        {DAYS.map((day) => (
          <DayCard key={day} day={day} timetable={timetable} />
        ))}
      </ul>

      {/*
        Sunday's absence was silent in the mockup — a reader could not tell
        whether the gym closes on Sundays or whether the row had been
        forgotten. This states exactly what is known (the timetable has no
        Sunday sessions) without inventing what is not (whether the doors
        are open). Questionnaire Q5.1.
      */}
      <p className="mt-5 text-sm text-text-3">
        No Sunday sessions are currently scheduled.
      </p>
    </Section>
  );
}
