"use client";

import { useId } from "react";

/**
 * The chrome every form control shares: label, hint, error, and the aria
 * wiring that connects them.
 *
 * Extracted when the contact form needed a textarea. The alternative was a
 * second component repeating the label markup, the describedby assembly
 * and the error styling — three things that have to stay identical for the
 * forms to look and behave like one site, and that nothing would have kept
 * identical.
 *
 * Children is a render function because the control needs ids the wrapper
 * generates. `useId` rather than a prop so no caller can accidentally
 * reuse one, which would silently point two labels at the same input.
 */

/**
 * Shared visual definition for input-like controls. `rounded-field` reads
 * --radius-field from globals.css rather than restating 10px, so the form
 * geometry stays part of the design system instead of drifting inside the
 * component tree.
 */
export const fieldControlClass =
  "w-full rounded-field border bg-input-bg px-3.5 py-3 text-sm text-text outline-none backdrop-blur-sm transition-colors placeholder:text-text-3 focus:border-accent";

/**
 * The hover lives here rather than in `fieldControlClass` on purpose.
 * Tailwind emits `hover:` variants after plain utilities, so a shared
 * `hover:border-*` would win over `border-crimson` and an invalid field
 * would drop its red border the moment the pointer crossed it — the one
 * moment it most needs to keep it. Branching means the error state has no
 * hover to be overridden by.
 */
export function fieldBorderClass(error?: string): string {
  return error ? "border-crimson" : "border-border hover:border-text-3";
}

export function Field({
  label,
  hint,
  error,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  children: (props: {
    id: string;
    describedBy: string | undefined;
    invalid: true | undefined;
  }) => React.ReactNode;
}) {
  const id = useId();
  const errorId = `${id}-error`;
  const hintId = `${id}-hint`;

  const describedBy =
    [error ? errorId : null, hint ? hintId : null].filter(Boolean).join(" ") ||
    undefined;

  return (
    <div className="flex flex-col gap-2">
      <label
        htmlFor={id}
        className="font-mono text-[11px] tracking-widest text-text-2 uppercase"
      >
        {label}
      </label>

      {children({ id, describedBy, invalid: error ? true : undefined })}

      {hint ? (
        <p id={hintId} className="text-xs text-text-3">
          {hint}
        </p>
      ) : null}

      {error ? (
        <p id={errorId} className="text-xs text-crimson">
          {error}
        </p>
      ) : null}
    </div>
  );
}
