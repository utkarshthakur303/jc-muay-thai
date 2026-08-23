import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { GoalCard } from "@/components/attendance/GoalCard";
import { MarkTodayControl } from "@/components/attendance/MarkTodayControl";
import { StreakRules } from "@/components/attendance/StreakRules";
import { TrainingGrid } from "@/components/attendance/TrainingGrid";
import { WeekStrip } from "@/components/attendance/WeekStrip";
import { WeeklyBars } from "@/components/attendance/WeeklyBars";
import { MemberShell } from "@/components/booking/MemberShell";
import { Icon } from "@/components/ui/Icon";
import { HISTORY_WEEKS } from "@/lib/attendance/history";
import { getStreakPage } from "@/lib/attendance/queries";
import { countUpcomingBookings } from "@/lib/booking/queries";
import { getUser } from "@/lib/supabase/server";

/**
 * The streak, in full.
 *
 * The popover on the home page is now a hover preview of this: the same
 * number, the same week, the same one button. Everything that could not
 * be read in the second a pointer rests on a flame lives here — the
 * goal, the two graphs, and the rules the number obeys.
 *
 * RENDERED ON THE SERVER, UNLIKE THE POPOVER
 *
 * The popover fetches after mount because it sits on the statically
 * prerendered home page, where reading the session during render would
 * cost the site its CDN cache. This page has no such constraint. It is a
 * member page like /account, so the real numbers ship in the HTML and
 * there is no loading state to design, no skeleton, and no moment where
 * a member sees a streak of zero before their real one arrives.
 */

export const metadata: Metadata = {
  title: "Your Streak",
  robots: { index: false, follow: false },
};

function ErrorCard() {
  return (
    <section className="mt-10 rounded-card border border-border bg-card p-6 sm:p-7">
      <h2 className="font-display text-2xl text-text">
        WE COULDN&apos;T LOAD YOUR STREAK
      </h2>
      {/*
        Deliberately not "you have no training days". A read failure and
        an empty history are indistinguishable in the data, and showing
        zero to somebody on a thirty-day run would send them to press the
        button and fix it — which is how a display bug becomes a wrong
        row in the database.
      */}
      <p className="mt-3 text-sm leading-relaxed text-text-2">
        Something went wrong reading your training history. Nothing has been
        lost — please refresh the page, or try again in a moment.
      </p>
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="font-mono text-[10px] tracking-[0.14em] text-text-3 uppercase">
        {label}
      </p>
      <p className="mt-1 font-mono text-base text-text">{value}</p>
    </div>
  );
}

export default async function StreakPage() {
  const user = await getUser();
  if (!user) redirect("/login?next=/streak");

  /**
   * The read throws on failure rather than returning an empty list — see
   * lib/attendance/queries.ts. Caught here so the page can say so in its
   * own words; letting it escape would render the framework's error
   * screen, which tells a member their whole account is broken.
   *
   * The booking count is fetched alongside it for the tab beside this
   * one. It reads zero on failure rather than throwing, so it cannot
   * take this page down for a number that is decoration.
   */
  const [result, upcomingCount] = await Promise.all([
    getStreakPage().then(
      (value) => ({ ok: true as const, value }),
      () => ({ ok: false as const, value: null }),
    ),
    countUpcomingBookings(),
  ]);

  const page = result.ok ? result.value : null;

  if (!page) {
    return (
      <MemberShell
        current="/streak"
        heading="Your streak"
        upcomingCount={upcomingCount}
      >
        <ErrorCard />
      </MemberShell>
    );
  }

  const { summary, goal, bars, rows } = page;
  const { current, best, total, markedToday, openToday, week } = summary;

  return (
    <MemberShell
      current="/streak"
      heading="Your streak"
      upcomingCount={upcomingCount}
    >
      <div className="mt-10 space-y-5">
        {/*
          The headline card. Same hierarchy as the popover — the streak is
          the big number because it is the one that can be lost, and best
          and total sit underneath so a reset does not feel like the whole
          history was erased.
        */}
        <section
          aria-labelledby="streak-heading"
          className="rounded-card border border-accent bg-card p-6 sm:p-7"
        >
          <h2 id="streak-heading" className="sr-only">
            Current streak
          </h2>

          <div className="flex items-center gap-4">
            <span
              className={`flex size-14 shrink-0 items-center justify-center rounded-full ${
                current > 0
                  ? "bg-accent/12 text-accent-strong"
                  : "bg-border/40 text-text-3"
              }`}
            >
              <Icon
                name="flame"
                size={28}
                className={current > 0 ? "flame-alive" : undefined}
              />
            </span>

            <div>
              <p className="font-display text-6xl leading-[0.85] text-text sm:text-7xl">
                {current}
              </p>
              <p className="mt-1.5 font-mono text-[11px] tracking-[0.14em] text-text-2 uppercase">
                {current === 1 ? "day in a row" : "days in a row"}
              </p>
            </div>
          </div>

          <div className="mt-7">
            <WeekStrip week={week} size="lg" />
          </div>

          <div className="mt-7">
            <MarkTodayControl markedToday={markedToday} />
          </div>

          <p className="mt-4 text-[13px] leading-relaxed text-text-3">
            {!openToday
              ? "The gym is closed today, so today can't break your streak — mark it anyway if you trained."
              : "Self-marked. Miss an open day and the streak starts again."}
          </p>

          <div className="mt-6 flex flex-wrap items-start gap-x-10 gap-y-4 border-t border-divider pt-5">
            <Stat
              label="Best streak"
              value={`${best} ${best === 1 ? "day" : "days"}`}
            />
            {/* "Days trained", not "Sessions" — the table holds one row
                per day, so a member who does two classes on a Tuesday
                counts once. Calling that "sessions" would overstate it by
                exactly the amount the keenest members train. */}
            <Stat label="Days trained" value={`${total}`} />
          </div>
        </section>

        <GoalCard
          current={current}
          goal={goal.goal}
          available={goal.available}
        />

        {/*
          No graphs until there is something to graph. Twelve empty bars
          and eighty-four empty squares is not an honest picture of a new
          member, it is a picture of a broken chart — and it is the first
          thing they would see.
        */}
        {total > 0 ? (
          <>
            <WeeklyBars bars={bars} />
            <TrainingGrid rows={rows} />
          </>
        ) : (
          <section className="rounded-card border border-border bg-card p-6 sm:p-7">
            <h2 className="font-mono text-[11px] tracking-[0.14em] text-text-3 uppercase">
              Your history
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-text-2">
              Mark your first day and the last {HISTORY_WEEKS} weeks appear
              here — how often you train, and which days you actually make.
            </p>
          </section>
        )}

        <StreakRules />
      </div>
    </MemberShell>
  );
}
