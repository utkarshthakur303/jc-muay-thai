"use client";

import { useActionState, useRef } from "react";
import { useFormStatus } from "react-dom";

import {
  DAYS,
  DAY_FULL_LABELS,
  LEVELS,
  LEVEL_LABELS,
  type DayId,
} from "@/content/schedule";
import { createSession } from "@/lib/admin/actions";
import { initialAdminState } from "@/lib/admin/state";
import { SyncReportNote } from "@/components/admin/SyncReportNote";

/**
 * Adding a class to the weekly pattern.
 *
 * Capacity defaults to 16 rather than being left blank, because 16 is
 * what every existing session carries and a blank number field is a
 * question the owner has to answer before he can add a Tuesday class.
 * It is still the invented figure flagged since launch — but now it is a
 * default in a box he can change, rather than a constant in a file he
 * cannot.
 */

const FIELD =
  "min-h-11 w-full rounded-full border border-border bg-input-bg px-4 text-sm text-text focus:border-accent focus:outline-none";
const LABEL =
  "block font-mono text-[10px] tracking-[0.12em] text-text-3 uppercase";

function Submit() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      aria-busy={pending}
      className="flex min-h-11 shrink-0 items-center rounded-full bg-accent px-6 font-mono text-[11px] font-semibold tracking-[0.08em] text-ink uppercase transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-55"
    >
      {pending ? "Adding…" : "Add class"}
    </button>
  );
}

export function AddSessionForm() {
  const [state, action] = useActionState(createSession, initialAdminState);
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <section className="mt-10">
      <h2 className="font-mono text-[11px] tracking-[0.12em] text-text-3 uppercase">
        Add a class
      </h2>

      <form
        ref={formRef}
        action={async (formData) => {
          await action(formData);
          // Cleared on the way out so the next class starts from a blank
          // form rather than the last one's times, which is how you end
          // up with two 9 AM beginner classes on a Tuesday.
          formRef.current?.reset();
        }}
        className="mt-3 flex flex-col gap-3 rounded-card border border-border p-5"
      >
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <div>
            <label className={LABEL} htmlFor="new-day">
              Day
            </label>
            <select id="new-day" name="day" className={`${FIELD} mt-1`}>
              {DAYS.map((day: DayId) => (
                <option key={day} value={day}>
                  {DAY_FULL_LABELS[day]}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className={LABEL} htmlFor="new-level">
              Class
            </label>
            <select id="new-level" name="level" className={`${FIELD} mt-1`}>
              {LEVELS.map((level) => (
                <option key={level} value={level}>
                  {LEVEL_LABELS[level]}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className={LABEL} htmlFor="new-start">
              Starts
            </label>
            <input
              id="new-start"
              type="time"
              name="start"
              required
              className={`${FIELD} mt-1`}
            />
          </div>

          <div>
            <label className={LABEL} htmlFor="new-end">
              Ends
            </label>
            <input
              id="new-end"
              type="time"
              name="end"
              required
              className={`${FIELD} mt-1`}
            />
          </div>

          <div>
            <label className={LABEL} htmlFor="new-capacity">
              Places
            </label>
            <input
              id="new-capacity"
              type="number"
              name="capacity"
              min={1}
              max={200}
              defaultValue={16}
              required
              className={`${FIELD} mt-1`}
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Submit />
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
    </section>
  );
}
