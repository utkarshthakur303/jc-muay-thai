"use client";

import Link from "next/link";
import { useActionState } from "react";

import { setPassword } from "@/lib/auth/actions";
import { initialAuthState } from "@/lib/validation/auth";
import { Alert } from "@/components/ui/Alert";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { TextField } from "@/components/ui/TextField";

/**
 * Two fields, and the form is replaced entirely on success.
 *
 * Leaving the inputs on screen after a saved password invites a second
 * submit, which would either fail as "same as the current password" or
 * quietly set a third one. Swapping in a confirmation makes the outcome
 * unambiguous and gives the one link that is actually useful next.
 */
export function SetPasswordForm() {
  const [state, formAction] = useActionState(setPassword, initialAuthState);

  if (state.status === "success") {
    return (
      <div className="flex flex-col gap-5">
        <Alert tone="success">{state.message}</Alert>
        <Link
          href="/account"
          className="flex min-h-12 w-full items-center justify-center rounded-full bg-accent px-7 font-mono text-[13px] font-semibold tracking-[0.08em] text-ink transition-colors hover:bg-accent-hover"
        >
          Back to your account
        </Link>
      </div>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-5" noValidate>
      {state.status === "error" && state.message ? (
        <Alert tone="error">{state.message}</Alert>
      ) : null}

      <TextField
        label="New password"
        name="password"
        type="password"
        autoComplete="new-password"
        required
        hint="At least 8 characters. Length beats punctuation — a phrase you can remember is stronger than a short word with symbols in it."
        error={state.fieldErrors?.password}
      />

      <TextField
        label="Repeat new password"
        name="confirmPassword"
        type="password"
        autoComplete="new-password"
        required
        error={state.fieldErrors?.confirmPassword}
      />

      <SubmitButton pendingLabel="Saving…">Save password</SubmitButton>
    </form>
  );
}
