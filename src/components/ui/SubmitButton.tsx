"use client";

import { useFormStatus } from "react-dom";

type SubmitButtonProps = {
  children: React.ReactNode;
  pendingLabel?: string;
  /**
   * Width override. Full width is right inside a 400px auth card and
   * wrong inside a 600px contact card, where it produces a button wider
   * than any button needs to be — a target that large stops reading as a
   * button and starts reading as a banner.
   */
  className?: string;
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
  className = "w-full",
}: SubmitButtonProps) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      aria-busy={pending}
      className={`flex min-h-12 items-center justify-center gap-2 rounded-full bg-accent px-7 font-mono text-[13px] font-semibold tracking-[0.08em] text-ink transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-60 ${className}`}
    >
      {pending ? (
        <>
          <span
            aria-hidden
            className="size-3.5 animate-spin rounded-full border-2 border-ink border-t-transparent"
          />
          {pendingLabel}
        </>
      ) : (
        children
      )}
    </button>
  );
}
