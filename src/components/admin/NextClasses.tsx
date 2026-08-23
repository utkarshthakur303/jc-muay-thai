import Link from "next/link";

/**
 * The classes closest to now, on the panel's front door.
 *
 * ── WHY THE OVERVIEW GREW A LIST ────────────────────────────────────
 * It was four counts and nothing else: true, and answering a question
 * nobody had. "How many upcoming bookings are there" is not what the
 * owner opens this panel to find out — "what is on tonight and is
 * anybody coming" is, and answering it took two more taps through the
 * Classes calendar every time.
 *
 * Six at most, because this is a summary and the calendar is the list.
 * The link at the end is how you get the rest, and it is always there
 * rather than appearing only when there are more than six — a control
 * that comes and goes is one you learn not to look for.
 *
 * Every date and time here arrives pre-formatted from the server, in the
 * gym's zone. The same rule as the class calendar: if this component did
 * its own date work, the owner checking tonight from a hotel in another
 * time zone would be shown his own local times for classes happening in
 * Jersey City.
 */

export type NextClass = {
  readonly id: string;
  /** "Today", "Tomorrow", or "Tue 26 Aug". */
  readonly day: string;
  /** "6:00–7:30 PM". */
  readonly time: string;
  readonly level: string;
  readonly bookedCount: number;
  readonly capacity: number;
  readonly cancelled: boolean;
};

export function NextClasses({ classes }: { classes: readonly NextClass[] }) {
  return (
    <section aria-labelledby="next-up" className="mt-10">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2
          id="next-up"
          className="font-mono text-[11px] tracking-[0.12em] text-text-3 uppercase"
        >
          Next up
        </h2>
        <Link
          href="/admin/classes"
          className="inline-flex min-h-11 items-center font-mono text-[11px] tracking-[0.08em] text-text-2 uppercase underline underline-offset-4 transition-colors hover:text-accent-strong"
        >
          All classes →
        </Link>
      </div>

      {classes.length === 0 ? (
        /*
          Not an empty box. Nothing scheduled in the next two days is a
          real state — the gym closes on Sundays and the horizon can run
          out — and saying which of those it is would be a guess, so it
          says the fact and points at the calendar.
        */
        <p className="mt-3 max-w-prose text-sm leading-relaxed text-text-2">
          Nothing scheduled in the next two days.
        </p>
      ) : (
        <ul role="list" className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {classes.map((klass) => {
            const full = !klass.cancelled && klass.bookedCount >= klass.capacity;
            return (
              <li key={klass.id} className="flex">
                <Link
                  href={`/admin/classes/${klass.id}`}
                  /*
                    Mutually exclusive branches, never concatenated —
                    Tailwind orders utilities by variant and not by
                    string position.
                  */
                  className={
                    klass.cancelled
                      ? "card-surface flex min-h-11 w-full flex-col rounded-card border border-divider px-5 py-4 transition-colors hover:border-text-3"
                      : "card-surface flex min-h-11 w-full flex-col rounded-card border border-border px-5 py-4 transition-colors hover:border-accent"
                  }
                >
                  <span className="flex flex-wrap items-baseline gap-x-2 font-mono text-[11px] tracking-[0.08em] text-text-3 uppercase">
                    <span className="text-text-2">{klass.day}</span>
                    <span>{klass.time}</span>
                  </span>

                  <span className="mt-1.5 text-sm font-semibold text-text">
                    {klass.level}
                  </span>

                  <span className="mt-2 flex flex-wrap items-baseline gap-x-2">
                    {klass.cancelled ? (
                      <span className="font-mono text-[11px] tracking-[0.08em] text-danger uppercase">
                        Cancelled
                      </span>
                    ) : (
                      <>
                        {/*
                          "Booked", never "attended". Nobody has been
                          anywhere yet, and this site's attendance is
                          self-marked in any case.
                        */}
                        <span className="font-mono text-[13px] tabular-nums text-text">
                          {klass.bookedCount} of {klass.capacity}
                        </span>
                        <span className="font-mono text-[11px] tracking-[0.06em] text-text-3 uppercase">
                          booked
                        </span>
                        {full ? (
                          <span className="font-mono text-[11px] tracking-[0.08em] text-accent-strong uppercase">
                            Full
                          </span>
                        ) : null}
                      </>
                    )}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
