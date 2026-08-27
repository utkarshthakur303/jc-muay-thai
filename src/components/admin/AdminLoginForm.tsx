"use client";

import { useActionState } from "react";

import { adminSignIn } from "@/lib/admin/authActions";
import { initialAdminAuthState } from "@/lib/validation/adminAuth";
import { Alert } from "@/components/ui/Alert";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { TextField } from "@/components/ui/TextField";

/**
 * Two fields and no third option, which is the point of the screen.
 *
 * NO "FORGOT PASSWORD" LINK, and the reason is mechanical rather than a
 * policy: a reset is delivered to an email address, and this form does not
 * collect one. The ID is an alias. Resolving it here to mail a link would
 * mean this screen telling an anonymous visitor which address the alias
 * stands for, which is the one fact the alias exists to keep quiet.
 *
 * Recovery is not lost, it just does not run through this door. The
 * account behind the alias is an ordinary Supabase account, so its own
 * email address recovers it at /forgot-password, and the dashboard can
 * reset it outright. Day to day the password is changed from inside the
 * panel at /admin/security, by someone already holding it.
 */
export function AdminLoginForm({ next }: { next: string }) {
  const [state, formAction] = useActionState(adminSignIn, initialAdminAuthState);

  return (
    <form action={formAction} className="flex flex-col gap-5" noValidate>
      <input type="hidden" name="next" value={next} />

      {state.status === "error" && state.message ? (
        <Alert tone="error">{state.message}</Alert>
      ) : null}

      <TextField
        label="Admin ID"
        name="loginId"
        type="text"
        /**
         * `username`, not `off`. Password managers key an entry on the
         * username field, and without one they offer to save the password
         * against no identity and then fail to fill it back in — which
         * pushes the owner toward a password simple enough to retype.
         */
        autoComplete="username"
        required
        defaultValue={state.values?.loginId}
        error={state.fieldErrors?.loginId}
      />

      <TextField
        label="Password"
        name="password"
        type="password"
        autoComplete="current-password"
        required
        error={state.fieldErrors?.password}
      />

      <SubmitButton pendingLabel="Checking…">Sign In</SubmitButton>
    </form>
  );
}
