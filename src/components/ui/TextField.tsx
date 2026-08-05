"use client";

import { useState } from "react";

import {
  Field,
  fieldBorderClass,
  fieldControlClass,
} from "@/components/ui/Field";

type TextFieldProps = {
  label: string;
  name: string;
  type?: "text" | "email" | "password";
  autoComplete?: string;
  required?: boolean;
  defaultValue?: string;
  error?: string;
  hint?: string;
};

export function TextField({
  label,
  name,
  type = "text",
  autoComplete,
  required,
  defaultValue,
  error,
  hint,
}: TextFieldProps) {
  const [revealed, setRevealed] = useState(false);

  const isPassword = type === "password";
  const inputType = isPassword && revealed ? "text" : type;

  return (
    <Field label={label} hint={hint} error={error}>
      {({ id, describedBy, invalid }) => (
        <div className="relative">
          <input
            id={id}
            name={name}
            type={inputType}
            autoComplete={autoComplete}
            required={required}
            defaultValue={defaultValue}
            aria-invalid={invalid}
            aria-describedby={describedBy}
            className={`${fieldControlClass} ${fieldBorderClass(error)} ${
              isPassword ? "pr-20" : ""
            }`}
          />

          {isPassword ? (
            <button
              type="button"
              onClick={() => setRevealed((v) => !v)}
              // Sits inside the field, so give it a real touch target.
              className="absolute inset-y-0 right-0 flex min-h-11 items-center px-3.5 font-mono text-[10px] tracking-[0.08em] text-text-2 uppercase transition-colors hover:text-accent-strong"
            >
              {revealed ? "Hide" : "Show"}
            </button>
          ) : null}
        </div>
      )}
    </Field>
  );
}
