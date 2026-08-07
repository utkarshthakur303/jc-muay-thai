"use client";

import {
  Field,
  fieldBorderClass,
  fieldControlClass,
} from "@/components/ui/Field";

/**
 * Multi-line input, sharing every visual and aria decision with TextField.
 *
 * `resize-y`, not `resize-none`: someone writing a long message should be
 * able to see what they have written. Horizontal resizing is disabled
 * because it can drag the field outside its own card.
 *
 * `maxLength` mirrors the schema's upper bound so the browser stops typing
 * at the limit rather than letting someone write past it and be told after
 * they submit. It is a courtesy, not a control — the server rejects
 * anything longer regardless, because a maxLength attribute is a
 * suggestion to whoever chooses to send the request.
 */
export function TextArea({
  label,
  name,
  rows = 5,
  required,
  defaultValue,
  error,
  hint,
  maxLength,
}: {
  label: string;
  name: string;
  rows?: number;
  required?: boolean;
  defaultValue?: string;
  error?: string;
  hint?: string;
  maxLength?: number;
}) {
  return (
    <Field label={label} hint={hint} error={error}>
      {({ id, describedBy, invalid }) => (
        // Grammarly and similar writing add-ons decorate textareas the way
        // password managers decorate inputs. Same reasoning as TextField —
        // see the comment there.
        <textarea
          suppressHydrationWarning
          id={id}
          name={name}
          rows={rows}
          required={required}
          defaultValue={defaultValue}
          maxLength={maxLength}
          aria-invalid={invalid}
          aria-describedby={describedBy}
          className={`${fieldControlClass} ${fieldBorderClass(error)} resize-y leading-relaxed`}
        />
      )}
    </Field>
  );
}
