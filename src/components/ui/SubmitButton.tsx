"use client";

import { useFormStatus } from "react-dom";

type SubmitButtonProps = {
  children: React.ReactNode;
  pendingLabel?: string;
};

/**
 * Reads the enclosing form's pending state, so it disables itself during
 * submission without any state plumbing. Double-submit protection comes
 * free — which matters here, since a second signUp() would fire a second
 * confirmation email.
 */
export function SubmitButton({
  children,
  pendingLabel = "Working…",
}: SubmitButtonProps) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      aria-busy={pending}
      className="flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-accent px-7 font-mono text-[13px] font-semibold tracking-[0.08em] text-[#0B0B0C] transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending ? (
        <>
          <span
            aria-hidden
            className="size-3.5 animate-spin rounded-full border-2 border-[#0B0B0C] border-t-transparent"
          />
          {pendingLabel}
        </>
      ) : (
        children
      )}
    </button>
  );
}
