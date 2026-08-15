import Link from "next/link";

import { AdminShell } from "@/components/admin/AdminShell";
import { LEVEL_LABELS } from "@/content/schedule";
import { site } from "@/content/site";
import { requireAdmin } from "@/lib/admin/guard";
import { listClasses, CLASS_WINDOW_DAYS, type AdminClass } from "@/lib/admin/classes";
import {
  classDayKey,
  formatClassDateLong,
  formatClassTimeRange,
  relativeDayLabel,
} from "@/lib/format/classTime";

/**
 * Every class in the next fortnight, grouped by the day it runs.
 *
 * Grouped rather than listed flat because the question this page answers
 * is "what is on tomorrow", and a flat list of eighty rows makes the
 * reader do the grouping in their head.
 */

export const metadata = { title: "Classes" };

function OccupancyBar({ klass }: { klass: AdminClass }) {
  const pct =
    klass.capacity > 0
      ? Math.min(100, Math.round((klass.bookedCount / klass.capacity) * 100))
      : 0;

  return (
    <div className="flex items-center gap-3">
      {/*
        The bar is decoration; the number beside it is the fact. It is
        aria-hidden so a screen reader is not told the same thing twice in
        a less useful form.
      */}
      <div
        aria-hidden
        className="h-1.5 w-16 overflow-hidden rounded-full bg-divider"
      >
        <div
          className={`h-full rounded-full ${
            klass.spotsLeft === 0 ? "bg-danger" : "bg-accent"
          }`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="font-mono text-[12px] tabular-nums text-text-2">
        {klass.bookedCount}/{klass.capacity}
      </span>
    </div>
  );
}

export default async function AdminClassesPage() {
  await requireAdmin();

  const classes = await listClasses();

  // Grouped in insertion order — the query already sorted by start time,
  // so days and the classes within them come out chronologically.
  const byDay = new Map<string, AdminClass[]>();
  for (const klass of classes) {
    const key = classDayKey(klass.startsAt, site.timeZone);
    const list = byDay.get(key) ?? [];
    list.push(klass);
    byDay.set(key, list);
  }

  return (
    <AdminShell
      current="/admin/classes"
      heading="Classes"
      lead={`Everything scheduled in the next ${CLASS_WINDOW_DAYS} days. Pick a class to see who is coming.`}
    >
      {classes.length === 0 ? (
        <p className="mt-10 text-sm leading-relaxed text-text-2">
          No classes scheduled in the next {CLASS_WINDOW_DAYS} days.
        </p>
      ) : (
        <div className="mt-10 flex flex-col gap-10">
          {[...byDay.entries()].map(([key, dayClasses]) => {
            const first = dayClasses[0];
            if (!first) return null;

            const relative = relativeDayLabel(first.startsAt, site.timeZone);

            return (
              <section key={key}>
                <h2 className="flex flex-wrap items-baseline gap-x-3 font-mono text-[11px] tracking-[0.12em] text-text-3 uppercase">
                  {relative ? (
                    <span className="text-accent-strong">{relative}</span>
                  ) : null}
                  <span>{formatClassDateLong(first.startsAt, site.timeZone)}</span>
                </h2>

                <ul role="list" className="mt-3 flex flex-col gap-2">
                  {dayClasses.map((klass) => (
                    <li key={klass.id}>
                      <Link
                        href={`/admin/classes/${klass.id}`}
                        className="card-surface flex flex-wrap items-center gap-x-5 gap-y-2 rounded-card border border-border px-5 py-4 transition-colors hover:border-accent"
                      >
                        <span className="min-w-32 font-mono text-[13px] tabular-nums text-text">
                          {formatClassTimeRange(
                            klass.startsAt,
                            klass.endsAt,
                            site.timeZone,
                          )}
                        </span>

                        <span className="min-w-28 text-sm font-semibold text-text">
                          {LEVEL_LABELS[klass.level]}
                        </span>

                        {klass.cancelled ? (
                          <span className="rounded-full bg-danger px-3 py-1 font-mono text-[10px] tracking-[0.08em] text-chalk uppercase">
                            Cancelled
                          </span>
                        ) : (
                          <OccupancyBar klass={klass} />
                        )}

                        {klass.cancelled && klass.cancellationNote ? (
                          <span className="text-[13px] text-text-2">
                            {klass.cancellationNote}
                          </span>
                        ) : null}

                        <span
                          aria-hidden
                          className="ml-auto font-mono text-[11px] text-text-3"
                        >
                          →
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      )}
    </AdminShell>
  );
}
