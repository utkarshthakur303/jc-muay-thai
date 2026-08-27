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
  /**
   * Which button this is when a form has two. `secondary` is an outline
   * on the card ground, so the pair reads as one action and one way out
   * rather than two equal choices.
   */
  variant?: "primary" | "secondary";
  /**
   * Submitted with the form, so two buttons in one form can mean two
   * different things. This is how the admin password form asks for a new
   * code from the same fields it uses to apply the change — the browser
   * sends only the button that was pressed.
   */
  name?: string;
  value?: string;
};

/**
 * Mutually exclusive, never concatenated.
 *
 * Appending `bg-card` to a base string already containing `bg-accent`
 * does not override it: Tailwind orders utilities by its own layer order,
 * not by position in the class attribute, so which one wins is a property
 * of the generated stylesheet rather than of this file. Branching means
 * only one background is ever named.
 */
const VARIANT_CLASSES: Record<"primary" | "secondary", string> = {
  primary: "bg-accent text-ink hover:bg-accent-hover",
  secondary: "border border-border bg-card text-text hover:border-accent-strong",
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
  variant = "primary",
  name,
  value,
}: SubmitButtonProps) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      name={name}
      value={value}
      disabled={pending}
      aria-busy={pending}
      className={`flex min-h-12 items-center justify-center gap-2 rounded-full px-7 font-mono text-[13px] font-semibold tracking-[0.08em] transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${VARIANT_CLASSES[variant]} ${className}`}
    >
      {pending ? (
        <>
          <span
            aria-hidden
            className="size-3.5 animate-spin rounded-full border-2 border-current border-t-transparent"
          />
          {pendingLabel}
        </>
      ) : (
        children
      )}
    </button>
  );
}
