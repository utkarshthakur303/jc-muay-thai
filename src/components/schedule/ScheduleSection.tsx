import { Section } from "@/components/layout/Section";
import { DayCard } from "@/components/schedule/DayCard";
import { TodayAtTheGym } from "@/components/schedule/TodayAtTheGym";
import {
  DAYS,
  SCHEDULE_NOTE,
  totalWeeklySessions,
} from "@/content/schedule";

/**
 * The full weekly timetable.
 *
 * Two things from the mockup are gone, and one is rebuilt differently.
 *
 * The scrolling marquee is gone. It carried a real sentence — the summer
 * caveat below — but delivered it as motion no one could pause, duplicated
 * in the DOM so the loop looked seamless, which made a screen reader read
 * it twice. WCAG 2.2.2 wants a pause control on anything moving for more
 * than five seconds, and building play/pause chrome around one sentence is
 * not a serious proposal. The sentence stays; the movement does not.
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
export function ScheduleSection() {
  return (
    <Section
      id="schedule"
      title="SCHEDULE"
      meta={`${totalWeeklySessions} sessions · Mon–Sat`}
      intro="Morning and evening classes six days a week. Kids and open-gym sessions run alongside the graded classes and are listed with them."
    >
      <TodayAtTheGym />

      {/*
        role="note" rather than an alert or a live region: it is standing
        information about the timetable, true whether or not anything just
        happened, so it should be read in document order and never
        interrupt.
      */}
      <p
        role="note"
        className="mt-4 rounded-2xl border border-accent/35 bg-accent/8 px-4 py-3 font-mono text-xs leading-relaxed tracking-[0.04em] text-accent-strong"
      >
        {SCHEDULE_NOTE}
      </p>

      <ul
        role="list"
        className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
      >
        {DAYS.map((day) => (
          <DayCard key={day} day={day} />
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
