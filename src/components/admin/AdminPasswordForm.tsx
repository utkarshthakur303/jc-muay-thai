"use client";

import { useActionState, useEffect, useState } from "react";

import { submitAdminPassword } from "@/lib/admin/authActions";
import { initialAdminPasswordState } from "@/lib/validation/adminAuth";
import { Alert } from "@/components/ui/Alert";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { TextField } from "@/components/ui/TextField";

/**
 * Change the admin password, in two steps, without leaving the panel.
 *
 * ── ONE FORM, NOT TWO ───────────────────────────────────────────────
 * The three password fields stay on screen for both steps rather than
 * being stashed in hidden inputs behind a second form. Two reasons, and
 * the second is the load-bearing one:
 *
 *   - A typo caught while waiting for the email is fixable in place.
 *   - Nothing about the new password is held on the server between the
 *     steps. It lives in this form until the code arrives and is
 *     submitted with it, so there is no pending-change record anywhere
 *     to expire, leak, or strand the account half-changed.
 *
 * The inputs are uncontrolled, so React re-rendering around them does
 * not disturb what has been typed. They are cleared exactly once, by
 * remount, when a change actually completes — see `generation`.
 * ────────────────────────────────────────────────────────────────────
 */
export function AdminPasswordForm() {
  const [state, formAction] = useActionState(
    submitAdminPassword,
    initialAdminPasswordState,
  );

  /**
   * Bumped only when a change completes, and used as the fieldset's key
   * so a completed change leaves empty boxes rather than the old
   * password sitting in a browser field on a laptop in a gym.
   *
   * A key derived directly from `status === "success"` would have wiped
   * the form again on the *next* submission that failed, because the
   * flag flips back and remounts a second time. A counter only ever goes
   * up, so each completion clears once and nothing else clears at all.
   */
  const [generation, setGeneration] = useState(0);
  const completed = state.status === "success" && state.step === "choose";

  useEffect(() => {
    if (completed) setGeneration((n) => n + 1);
  }, [completed]);

  const verifying = state.step === "verify";

  return (
    <form action={formAction} className="mt-6 flex flex-col gap-5" noValidate>
      {state.message ? (
        <Alert tone={state.status === "success" ? "success" : "error"}>
          {state.message}
        </Alert>
      ) : null}

      <div key={generation} className="flex flex-col gap-5">
        <TextField
          label="Current password"
          name="currentPassword"
          type="password"
          autoComplete="current-password"
          required
          error={state.fieldErrors?.currentPassword}
        />

        <TextField
          label="New password"
          name="newPassword"
          type="password"
          autoComplete="new-password"
          required
          hint="At least 8 characters. Length beats punctuation — a phrase you can remember is stronger than a short word with symbols in it."
          error={state.fieldErrors?.newPassword}
        />

        <TextField
          label="Repeat new password"
          name="confirmPassword"
          type="password"
          autoComplete="new-password"
          required
          error={state.fieldErrors?.confirmPassword}
        />

        {/*
          Rendered only on the second step. Present from the start it
          would be a box with nothing to put in it, and an autofocus
          target that steals the cursor from the field actually being
          filled in.
        */}
        {verifying ? (
          <TextField
            label="Code from your email"
            name="code"
            type="text"
            autoComplete="one-time-code"
            required
            hint="Sent to the admin account's email address. It expires shortly."
            error={state.fieldErrors?.code}
          />
        ) : null}
      </div>

      <div className="flex flex-col gap-3 sm:flex-row-reverse sm:items-center">
        <SubmitButton
          name="intent"
          value={verifying ? "verify" : "request"}
          pendingLabel={verifying ? "Changing…" : "Sending…"}
          className="w-full sm:w-auto"
        >
          {verifying ? "Change password" : "Email me a code"}
        </SubmitButton>

        {verifying ? (
          <SubmitButton
            name="intent"
            value="request"
            variant="secondary"
            pendingLabel="Sending…"
            className="w-full sm:w-auto"
          >
            Send a new code
          </SubmitButton>
        ) : null}
      </div>
    </form>
  );
}
