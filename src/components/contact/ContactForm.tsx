"use client";

import { useActionState } from "react";

import { Alert } from "@/components/ui/Alert";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { TextArea } from "@/components/ui/TextArea";
import { TextField } from "@/components/ui/TextField";
import { submitContactMessage } from "@/lib/contact/actions";
import { HONEYPOT_FIELD } from "@/lib/validation/contact";
import { initialFormState } from "@/lib/validation/fields";

/**
 * The enquiry form.
 *
 * A plain <form action={...}> around a server action, which means it
 * works before hydration: the browser posts it natively, the action runs,
 * and the response comes back. JavaScript upgrades the experience —
 * in-place errors, a pending button — rather than being the thing that
 * makes it function at all. On a marketing page whose entire job is to
 * generate enquiries, that distinction is worth the small amount of care
 * it takes.
 *
 * The page around it stays statically prerendered. A server action is a
 * POST endpoint of its own, so having a form here costs the page nothing —
 * it is still HTML on a CDN until someone actually submits something.
 */
export function ContactForm() {
  const [state, formAction] = useActionState(
    submitContactMessage,
    initialFormState,
  );

  /**
   * Success replaces the form rather than sitting above it. Leaving a
   * filled-in form on screen under "message sent" is an invitation to
   * press the button again, and the second copy of an enquiry is noise
   * for whoever answers it.
   */
  if (state.status === "success") {
    return (
      <div className="card-surface flex flex-col gap-4 p-6 sm:p-8">
        <Alert tone="success">{state.message}</Alert>
        <p className="text-sm leading-relaxed text-text-2">
          If it&rsquo;s about your first class, mention which level you have
          in mind — beginner, intermediate or advanced — and we&rsquo;ll get
          you into the right session.
        </p>
      </div>
    );
  }

  return (
    <form
      action={formAction}
      className="card-surface flex flex-col gap-5 p-6 sm:p-8"
      // The browser's own required/type checks fire before the action and
      // produce messages we cannot style, position or translate. The
      // server validates everything anyway, so this hands the whole job to
      // one implementation that is consistent and always runs.
      noValidate
    >
      {state.status === "error" && state.message ? (
        <Alert tone="error">{state.message}</Alert>
      ) : null}

      <TextField
        label="Name"
        name="name"
        autoComplete="name"
        required
        defaultValue={state.values?.name}
        error={state.fieldErrors?.name}
      />

      <TextField
        label="Email"
        name="email"
        type="email"
        autoComplete="email"
        required
        defaultValue={state.values?.email}
        error={state.fieldErrors?.email}
        hint="So we can reply. Nothing else is sent to it."
      />

      <TextArea
        label="Message"
        name="message"
        required
        maxLength={2000}
        defaultValue={state.values?.message}
        error={state.fieldErrors?.message}
      />

      {/*
        Honeypot. Positioned off-screen rather than display:none, because a
        bot worth defending against checks for the latter — and hidden from
        assistive technology and the tab order so it cannot trap a real
        person who never sees it. aria-hidden alone would not be enough:
        without tabIndex={-1} a keyboard user tabs into a field they cannot
        see and has no idea why focus vanished.
      */}
      <div
        aria-hidden
        className="pointer-events-none absolute left-[-9999px] h-0 w-0 overflow-hidden"
      >
        <label htmlFor={HONEYPOT_FIELD}>Website</label>
        <input
          id={HONEYPOT_FIELD}
          name={HONEYPOT_FIELD}
          type="text"
          tabIndex={-1}
          autoComplete="off"
        />
      </div>

      <SubmitButton
        pendingLabel="Sending…"
        className="w-full sm:w-auto sm:min-w-52 sm:self-start"
      >
        Send message
      </SubmitButton>
    </form>
  );
}
