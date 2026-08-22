"use client";

import { LEVEL_LABELS, type LevelId } from "@/content/schedule";
import { site } from "@/content/site";
import { formatInstant } from "@/lib/format/classTime";
import type { AdminActionState } from "@/lib/admin/state";

/**
 * What an edit did to the classes already on the calendar — and, more to
 * the point, what it deliberately did NOT do.
 *
 * The counts are reassurance. The two lists below them are the reason
 * this component exists: an edit that would have removed a class somebody
 * has booked leaves it standing, and the owner has to find out here
 * rather than from the member turning up to a class that no longer runs.
 *
 * Rendered as a warning, not an error, because nothing went wrong — the
 * timetable saved. There is simply a consequence with a person's name on
 * it, and the panel refuses to be quiet about it.
 */
export function SyncReportNote({ sync }: { sync: AdminActionState["sync"] }) {
  if (!sync) return null;

  const { flagged, capacityBlocked } = sync;
  if (flagged.length === 0 && capacityBlocked.length === 0) return null;

  return (
    <div className="mt-2 rounded-card border border-danger px-5 py-4">
      {flagged.length > 0 ? (
        <>
          <p className="text-sm leading-relaxed text-text">
            <strong className="font-semibold">
              {flagged.length}{" "}
              {flagged.length === 1 ? "class was" : "classes were"} left in
              place because {flagged.length === 1 ? "it has" : "they have"} a
              booking.
            </strong>{" "}
            The timetable is saved, but {flagged.length === 1 ? "this class" : "these classes"}{" "}
            still exists on the calendar. Cancel {flagged.length === 1 ? "it" : "them"}{" "}
            from the Classes screen — that tells the members by email. Deleting
            {flagged.length === 1 ? " it" : " them"} here would not have.
          </p>
          <ul role="list" className="mt-3 flex flex-col gap-1">
            {flagged.map((row) => (
              <li
                key={row.id}
                className="font-mono text-[12px] tabular-nums text-text-2"
              >
                {LEVEL_LABELS[row.level as LevelId] ?? row.level} ·{" "}
                {formatInstant(row.startsAt, site.timeZone)} ·{" "}
                {row.bookedCount} booked
              </li>
            ))}
          </ul>
        </>
      ) : null}

      {capacityBlocked.length > 0 ? (
        <>
          <p
            className={`text-sm leading-relaxed text-text ${flagged.length > 0 ? "mt-4" : ""}`}
          >
            <strong className="font-semibold">
              {capacityBlocked.length}{" "}
              {capacityBlocked.length === 1 ? "class kept" : "classes kept"} the
              old number of places.
            </strong>{" "}
            More people are already booked than the new limit allows, and
            nobody is removed from a class they booked to satisfy a number
            typed on this screen.
          </p>
          <ul role="list" className="mt-3 flex flex-col gap-1">
            {capacityBlocked.map((row) => (
              <li
                key={`${row.startsAt}-${row.level}`}
                className="font-mono text-[12px] tabular-nums text-text-2"
              >
                {LEVEL_LABELS[row.level as LevelId] ?? row.level} ·{" "}
                {formatInstant(row.startsAt, site.timeZone)} · {row.bookedCount}{" "}
                booked, you asked for {row.requested}
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </div>
  );
}
