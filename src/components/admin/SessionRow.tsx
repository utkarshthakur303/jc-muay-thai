"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";

import {
  DAYS,
  DAY_FULL_LABELS,
  LEVELS,
  LEVEL_LABELS,
  type DayId,
} from "@/content/schedule";
import { deleteSession, updateSession } from "@/lib/admin/actions";
import { initialAdminState } from "@/lib/admin/state";
import { formatRangeCompact } from "@/lib/format/time";
import { SyncReportNote } from "@/components/admin/SyncReportNote";
import type { TimetableEntry } from "@/lib/schedule/queries";

/**
 * One class in the weekly pattern: read-only until you press Edit.
 *
 * COLLAPSED BY DEFAULT, and that is the important decision. Thirty-four
 * sessions rendered as thirty-four open forms is a wall of a hundred and
 * seventy inputs, where the tab order runs through every field of every
 * class and any stray keystroke edits something. Read mode is what this
 * screen is for most of the time — the owner comes to look at the
 * timetable far more often than to change it.
 */

const FIELD =
  "min-h-11 w-full rounded-full border border-border bg-input-bg px-4 text-sm text-text focus:border-accent focus:outline-none";
const LABEL =
  "block font-mono text-[10px] tracking-[0.12em] text-text-3 uppercase";

function SaveButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      aria-busy={pending}
      className="flex min-h-11 shrink-0 items-center rounded-full bg-accent px-5 font-mono text-[11px] font-semibold tracking-[0.08em] text-ink uppercase transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-55"
    >
      {pending ? "Saving…" : "Save"}
    </button>
  );
}

function DeleteButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      /*
        The accessible name says WHICH class. Thirty-four buttons all
        called "Remove" is a screen reader reading the same word down the
        page with no way to tell them apart.
      */
      aria-label={`Remove ${label}`}
      className="flex min-h-11 shrink-0 items-center rounded-full border border-border px-4 font-mono text-[11px] tracking-[0.08em] text-text-2 uppercase transition-colors hover:border-danger hover:text-danger disabled:cursor-not-allowed disabled:opacity-55"
    >
      {pending ? "Removing…" : "Remove"}
    </button>
  );
}

export function SessionRow({
  entry,
  editable,
}: {
  entry: TimetableEntry;
  /**
   * False when the row came from the compiled-in fallback rather than the
   * database. Such a row has no real id, so its controls could not work —
   * they are not rendered rather than rendered and broken.
   */
  editable: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [state, action] = useActionState(updateSession, initialAdminState);
  const [removeState, removeAction] = useActionState(
    deleteSession,
    initialAdminState,
  );

  const label = `${LEVEL_LABELS[entry.level]}, ${DAY_FULL_LABELS[entry.day]} ${formatRangeCompact(entry.start, entry.end)}`;

  if (!editable) {
    return (
      <li className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-divider py-3 last:border-b-0">
        <span className="min-w-40 flex-1">
          <span className="block text-sm font-semibold text-text">
            {LEVEL_LABELS[entry.level]}
          </span>
          <span className="mt-0.5 block font-mono text-[12px] tabular-nums text-text-2">
            {formatRangeCompact(entry.start, entry.end)}
          </span>
        </span>
        <span className="font-mono text-[12px] tabular-nums text-text-3">
          {entry.capacity} places
        </span>
      </li>
    );
  }

  if (!editing) {
    return (
      <li className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-divider py-3 last:border-b-0">
        <span className="min-w-40 flex-1">
          <span className="block text-sm font-semibold text-text">
            {LEVEL_LABELS[entry.level]}
          </span>
          <span className="mt-0.5 block font-mono text-[12px] tabular-nums text-text-2">
            {formatRangeCompact(entry.start, entry.end)}
          </span>
        </span>

        <span className="font-mono text-[12px] tabular-nums text-text-3">
          {entry.capacity} places
        </span>

        <button
          type="button"
          onClick={() => setEditing(true)}
          aria-label={`Edit ${label}`}
          className="flex min-h-11 shrink-0 items-center rounded-full border border-border px-4 font-mono text-[11px] tracking-[0.08em] text-text-2 uppercase transition-colors hover:border-accent hover:text-accent-strong"
        >
          Edit
        </button>

        {/*
          Two presses to delete, and no browser confirm(). A timetable
          row is not a dialog's worth of ceremony, but removing one can
          take a class off the calendar for weeks — an accidental single
          click is too cheap.
        */}
        {confirming ? (
          <form action={removeAction} className="flex items-center gap-2">
            <input type="hidden" name="id" value={entry.id} />
            <span className="font-mono text-[11px] text-danger uppercase">
              Sure?
            </span>
            <DeleteButton label={label} />
            <button
              type="button"
              onClick={() => setConfirming(false)}
              className="flex min-h-11 shrink-0 items-center px-2 font-mono text-[11px] tracking-[0.08em] text-text-3 uppercase hover:text-text"
            >
              Keep
            </button>
          </form>
        ) : (
          <button
            type="button"
            onClick={() => setConfirming(true)}
            aria-label={`Remove ${label}`}
            className="flex min-h-11 shrink-0 items-center rounded-full border border-border px-4 font-mono text-[11px] tracking-[0.08em] text-text-2 uppercase transition-colors hover:border-danger hover:text-danger"
          >
            Remove
          </button>
        )}

        {removeState.status === "error" && removeState.message ? (
          <p role="alert" className="w-full text-[13px] leading-snug text-danger">
            {removeState.message}
          </p>
        ) : null}

        {/*
          Removing a class is the likeliest way to orphan one somebody has
          booked, so the report belongs here as much as on the edit form.
          It was wired only into "Add a class" at first, which meant the
          one path that could strand a member was the one that said
          nothing.
        */}
        <div className="w-full">
          <SyncReportNote sync={removeState.sync} />
        </div>
      </li>
    );
  }

  return (
    <li className="border-b border-divider py-4 last:border-b-0">
      <form action={action} className="flex flex-col gap-3">
        <input type="hidden" name="id" value={entry.id} />

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <div>
            <label className={LABEL} htmlFor={`day-${entry.id}`}>
              Day
            </label>
            <select
              id={`day-${entry.id}`}
              name="day"
              defaultValue={entry.day}
              className={`${FIELD} mt-1`}
            >
              {DAYS.map((day: DayId) => (
                <option key={day} value={day}>
                  {DAY_FULL_LABELS[day]}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className={LABEL} htmlFor={`level-${entry.id}`}>
              Class
            </label>
            <select
              id={`level-${entry.id}`}
              name="level"
              defaultValue={entry.level}
              className={`${FIELD} mt-1`}
            >
              {LEVELS.map((level) => (
                <option key={level} value={level}>
                  {LEVEL_LABELS[level]}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className={LABEL} htmlFor={`start-${entry.id}`}>
              Starts
            </label>
            <input
              id={`start-${entry.id}`}
              type="time"
              name="start"
              defaultValue={entry.start}
              required
              className={`${FIELD} mt-1`}
            />
          </div>

          <div>
            <label className={LABEL} htmlFor={`end-${entry.id}`}>
              Ends
            </label>
            <input
              id={`end-${entry.id}`}
              type="time"
              name="end"
              defaultValue={entry.end}
              required
              className={`${FIELD} mt-1`}
            />
          </div>

          <div>
            <label className={LABEL} htmlFor={`capacity-${entry.id}`}>
              Places
            </label>
            <input
              id={`capacity-${entry.id}`}
              type="number"
              name="capacity"
              min={1}
              max={200}
              defaultValue={entry.capacity}
              required
              className={`${FIELD} mt-1`}
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <SaveButton />
          <button
            type="button"
            onClick={() => setEditing(false)}
            className="flex min-h-11 shrink-0 items-center px-2 font-mono text-[11px] tracking-[0.08em] text-text-3 uppercase hover:text-text"
          >
            Cancel
          </button>

          {state.status === "error" && state.message ? (
            <p role="alert" className="text-[13px] leading-snug text-danger">
              {state.message}
            </p>
          ) : null}
          {state.status === "success" && state.message ? (
            <p role="status" className="text-[13px] leading-snug text-text-2">
              {state.message}
            </p>
          ) : null}
        </div>

        <SyncReportNote sync={state.sync} />
      </form>
    </li>
  );
}
