"use client";

import Link from "next/link";
import { useActionState } from "react";

import { signIn } from "@/lib/auth/actions";
import { initialAuthState } from "@/lib/validation/auth";
import { Alert } from "@/components/ui/Alert";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { TextField } from "@/components/ui/TextField";

export function LoginForm({ next }: { next: string }) {
  const [state, formAction] = useActionState(signIn, initialAuthState);

  return (
    <form action={formAction} className="flex flex-col gap-5" noValidate>
      <input type="hidden" name="next" value={next} />

      {state.status === "error" && state.message ? (
        <Alert tone="error">{state.message}</Alert>
      ) : null}

      <TextField
        label="Email"
        name="email"
        type="email"
        autoComplete="email"
        required
        defaultValue={state.values?.email}
        error={state.fieldErrors?.email}
      />

      <div className="flex flex-col gap-2">
        <TextField
          label="Password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          error={state.fieldErrors?.password}
        />
        <Link
          href="/forgot-password"
          className="self-end font-mono text-[11px] uppercase tracking-[0.08em] text-text-2 transition-colors hover:text-accent-strong"
        >
          Forgot password?
        </Link>
      </div>

      <SubmitButton pendingLabel="Signing in…">Sign In</SubmitButton>
    </form>
  );
}
