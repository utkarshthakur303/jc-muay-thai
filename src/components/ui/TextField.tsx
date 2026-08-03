"use client";

import { useId, useState } from "react";

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
  const id = useId();
  const errorId = `${id}-error`;
  const hintId = `${id}-hint`;
  const [revealed, setRevealed] = useState(false);

  const isPassword = type === "password";
  const inputType = isPassword && revealed ? "text" : type;

  const describedBy =
    [error ? errorId : null, hint ? hintId : null].filter(Boolean).join(" ") ||
    undefined;

  return (
    <div className="flex flex-col gap-2">
      <label
        htmlFor={id}
        className="font-mono text-[11px] uppercase tracking-[0.1em] text-text-2"
      >
        {label}
      </label>

      <div className="relative">
        <input
          id={id}
          name={name}
          type={inputType}
          autoComplete={autoComplete}
          required={required}
          defaultValue={defaultValue}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className={`w-full rounded-[10px] border bg-input-bg px-3.5 py-3 backdrop-blur-sm text-sm text-text outline-none transition-colors placeholder:text-text-3 focus:border-accent ${
            isPassword ? "pr-20" : ""
          } ${error ? "border-crimson" : "border-border"}`}
        />

        {isPassword ? (
          <button
            type="button"
            onClick={() => setRevealed((v) => !v)}
            // Sits inside the field, so give it a real touch target.
            className="absolute inset-y-0 right-0 flex min-h-11 items-center px-3.5 font-mono text-[10px] uppercase tracking-[0.08em] text-text-2 transition-colors hover:text-accent"
          >
            {revealed ? "Hide" : "Show"}
          </button>
        ) : null}
      </div>

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
