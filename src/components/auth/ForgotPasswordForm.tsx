"use client";

import { useActionState } from "react";

import { requestPasswordReset } from "@/lib/auth/actions";
import { initialAuthState } from "@/lib/validation/auth";
import { Alert } from "@/components/ui/Alert";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { TextField } from "@/components/ui/TextField";

export function ForgotPasswordForm() {
  const [state, formAction] = useActionState(
    requestPasswordReset,
    initialAuthState,
  );

  if (state.status === "success") {
    return <Alert tone="success">{state.message}</Alert>;
  }

  return (
    <form action={formAction} className="flex flex-col gap-5" noValidate>
      <TextField
        label="Email"
        name="email"
        type="email"
        autoComplete="email"
        required
        error={state.fieldErrors?.email}
      />
      <SubmitButton pendingLabel="Sending…">Send Reset Link</SubmitButton>
    </form>
  );
}
