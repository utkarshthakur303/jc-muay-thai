import { AddSessionForm } from "@/components/admin/AddSessionForm";
import { AdminShell } from "@/components/admin/AdminShell";
import { SessionRow } from "@/components/admin/SessionRow";
import { DAYS, DAY_FULL_LABELS } from "@/content/schedule";
import { requireAdmin } from "@/lib/admin/guard";
import { getTimetableByDay } from "@/lib/admin/timetable";

/**
 * The weekly timetable, editable.
 *
 * Until 2026-08-22 this pattern lived in src/content/schedule.ts, so
 * moving a class meant a developer, a commit and a deploy — which in
 * practice meant it was done by hand against `class_occurrences` in the
 * Supabase console instead. Three months of that is how the site ended
 * up advertising a Friday open gym the gym does not run, Saturday
 * evening classes it does not run, and nine kids' classes at 8 AM.
 *
 * ONE SCREEN, TWO CONSEQUENCES, AND THE SECOND IS THE POINT. Saving here
 * writes a row to `class_sessions` — that is the easy half, and it is
 * what the public timetable reads. It then rebuilds the dated classes
 * for the next sixty days, and that half can touch something a member
 * has already booked. It never does: anything with a booking on it is
 * left standing and reported back on this page, for the owner to cancel
 * properly from the Classes screen where cancelling sends an email.
 *
 * Grouped by day rather than shown as a six-column grid, for the same
 * reason the public schedule is: a week-by-level table needs about 640px
 * before it stops being a horizontal scroll, and the client asked for
 * this panel to work on a phone.
 */

export const metadata = { title: "Timetable" };

export default async function AdminTimetablePage() {
  await requireAdmin();

  const { byDay, total, source } = await getTimetableByDay(DAYS);
  const editable = source === "database";

  return (
    <AdminShell
      current="/admin/timetable"
      heading="Timetable"
      lead="The weekly pattern. Changing it rebuilds the classes members can book — except any that are already booked."
    >
      <p className="mt-6 font-mono text-[12px] tabular-nums text-text-3">
        {total} {total === 1 ? "class" : "classes"} a week · Monday to Saturday
      </p>

      {/*
        No editable table, no edit controls. The rows below are the
        fallback compiled into the build, and they carry no database id —
        an Edit button over one would be a control that cannot do what it
        says. Saying so is the honest version.
      */}
      {editable ? null : (
        <div className="mt-5 rounded-card border border-danger px-5 py-4">
          <p className="text-sm leading-relaxed text-text">
            <strong className="font-semibold">
              The timetable is not editable yet.
            </strong>{" "}
            The <code className="font-mono text-[13px]">class_sessions</code>{" "}
            table has not been created, so what you see below is the schedule
            built into the site rather than rows in the database. Run the
            migration <code className="font-mono text-[13px]">20260822120000_class_sessions.sql</code>{" "}
            and this page becomes editable — members keep seeing the correct
            timetable either way.
          </p>
        </div>
      )}

      {/*
        Sunday has no section and no "add" row, because the gym is closed
        and the day list this maps over does not contain it. A session on
        a closed day is refused by the database as well — see the day
        check in the migration. Two fences, because this is the exact
        shape of the bug that put classes on a Friday evening the gym is
        shut for.
      */}
      <div className="mt-6 flex flex-col gap-5">
        {byDay.map(({ day, sessions }) => (
          <section
            key={day}
            aria-labelledby={`day-${day}`}
            className="card-surface rounded-card border border-border px-5 py-4 sm:px-6"
          >
            <div className="flex flex-wrap items-baseline justify-between gap-3 border-b border-border pb-3">
              <h2
                id={`day-${day}`}
                className="font-display text-2xl tracking-[0.02em] text-text"
              >
                {DAY_FULL_LABELS[day]}
              </h2>
              <p className="font-mono text-[11px] tracking-[0.06em] text-text-3 uppercase">
                {sessions.length}{" "}
                {sessions.length === 1 ? "class" : "classes"}
              </p>
            </div>

            {sessions.length === 0 ? (
              <p className="py-4 text-sm leading-relaxed text-text-2">
                Nothing scheduled. Members will see this day as closed.
              </p>
            ) : (
              <ul role="list" className="flex flex-col">
                {sessions.map((entry) => (
                  <SessionRow
                    key={entry.id}
                    entry={entry}
                    editable={editable}
                  />
                ))}
              </ul>
            )}
          </section>
        ))}
      </div>

      {editable ? <AddSessionForm /> : null}

      <p className="mt-8 max-w-prose text-[13px] leading-relaxed text-text-3">
        Changes take effect straight away — on this page, on the public
        timetable, and on what members can book. Classes that have already
        happened are never altered; they are the record of what actually ran.
      </p>
    </AdminShell>
  );
}
