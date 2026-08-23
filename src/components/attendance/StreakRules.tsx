import { DAY_FULL_LABELS, DAYS } from "@/content/schedule";

/**
 * The rules, stated plainly, at the bottom of the page they govern.
 *
 * WHY THIS IS ON THE PAGE AND NOT IN A HELP ARTICLE
 *
 * Every one of these five lines is a question somebody would otherwise
 * ask the gym. "Why did my streak reset?" and "why didn't Sunday count?"
 * are not edge cases — they are what happens the first week a member
 * uses this, and the honest place to answer them is where the number is.
 *
 * The open days come from the timetable, never from a hardcoded "Monday
 * to Saturday" here. If Sunday sessions are ever added, streak.ts follows
 * in the same edit — and so does this sentence, instead of quietly
 * describing a gym that no longer exists.
 */

const first = DAYS[0];
const last = DAYS[DAYS.length - 1];

const OPEN_DAYS =
  first && last && DAYS.length > 1
    ? `${DAY_FULL_LABELS[first]} to ${DAY_FULL_LABELS[last]}`
    : DAYS.map((day) => DAY_FULL_LABELS[day]).join(", ");

const RULES: readonly { readonly title: string; readonly body: string }[] = [
  {
    title: "You keep this record, not the gym",
    body: "Nothing here is checked against a register or a door scanner. You mark the days you trained, and the number is only as true as you make it.",
  },
  {
    title: "Sundays are stepped over",
    body: `Classes run ${OPEN_DAYS}. Train on Saturday, then again on Monday, and the streak holds — nobody loses one to a day the doors were shut.`,
  },
  {
    title: "Today isn't a miss until it's over",
    body: "An unmarked today doesn't break anything. Your streak stands at yesterday's number until the day is out, so there is no penalty for opening this page in the morning.",
  },
  {
    title: "Miss an open day and it starts again",
    body: "That is the whole point of a streak, and it is why your best is kept separately. A reset costs you the run, not the history.",
  },
  {
    title: "Only today can be marked",
    body: "No backdating, and no filling in last week on a Sunday night. It is enforced by the database, not by this page, and it is what stops the number becoming a form.",
  },
];

export function StreakRules() {
  return (
    <section
      aria-labelledby="rules-heading"
      className="rounded-card border border-border bg-card p-6 sm:p-7"
    >
      <h2
        id="rules-heading"
        className="font-mono text-[11px] tracking-[0.14em] text-text-3 uppercase"
      >
        How your streak works
      </h2>

      <dl className="mt-5 space-y-5">
        {RULES.map((rule) => (
          <div key={rule.title}>
            <dt className="text-sm font-semibold text-text">{rule.title}</dt>
            <dd className="mt-1 text-sm leading-relaxed text-text-2">
              {rule.body}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
