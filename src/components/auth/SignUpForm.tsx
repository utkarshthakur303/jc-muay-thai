"use client";

import { useActionState } from "react";

import { signUp } from "@/lib/auth/actions";
import { initialAuthState } from "@/lib/validation/auth";
import { Alert } from "@/components/ui/Alert";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { TextField } from "@/components/ui/TextField";

export function SignUpForm({ next }: { next: string }) {
  const [state, formAction] = useActionState(signUp, initialAuthState);

  // On success the form is replaced entirely — leaving the fields on screen
  // invites a second submit, which would send a second confirmation email.
  if (state.status === "success") {
    return (
      <div className="flex flex-col gap-4">
        <Alert tone="success">{state.message}</Alert>
        <p className="text-sm leading-relaxed text-text-2">
          The link is valid for 24 hours. If it doesn&apos;t arrive within a few
          minutes, check your spam folder.
        </p>
      </div>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-5" noValidate>
      {/* Rides on the confirmation email's redirect, so someone who set out
          to book a class is returned to the booking page rather than the
          home page after confirming. */}
      <input type="hidden" name="next" value={next} />

      {state.status === "error" && state.message ? (
        <Alert tone="error">{state.message}</Alert>
      ) : null}

      <TextField
        label="Full name"
        name="fullName"
        autoComplete="name"
        required
        defaultValue={state.values?.fullName}
        error={state.fieldErrors?.fullName}
      />

      <TextField
        label="Email"
        name="email"
        type="email"
        autoComplete="email"
        required
        defaultValue={state.values?.email}
        error={state.fieldErrors?.email}
      />

      <TextField
        label="Password"
        name="password"
        type="password"
        autoComplete="new-password"
        required
        hint="At least 8 characters."
        error={state.fieldErrors?.password}
      />

      <SubmitButton pendingLabel="Creating account…">
        Create Account
      </SubmitButton>
    </form>
  );
}
