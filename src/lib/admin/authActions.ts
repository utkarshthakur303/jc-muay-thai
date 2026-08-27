"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { serverEnv } from "@/lib/env.server";
import { resolveAdminLogin, safeAdminNext } from "@/lib/admin/loginId";
import {
  MEMBER_COOKIE,
  MEMBER_COOKIE_MAX_AGE,
  encodeMember,
  memberCookieOptions,
  memberDisplayFrom,
} from "@/lib/auth/memberCookie";
import { fieldErrorsFrom } from "@/lib/validation/fields";
import {
  adminPasswordConfirmSchema,
  adminPasswordRequestSchema,
  adminSignInSchema,
  type AdminAuthFormState,
  type AdminPasswordState,
} from "@/lib/validation/adminAuth";

/**
 * Only async functions may be exported from a "use server" module. A
 * single `const` export makes Next refuse to load the module, and the
 * symptom is not a build failure — `tsc` and `next build` both pass, and
 * every server action in the file silently stops responding at runtime.
 * Constants and types belong in loginId.ts and validation/adminAuth.ts.
 */

/**
 * Floor on how long a failed sign-in takes.
 *
 * Without it the ID is readable from a stopwatch: a wrong ID returns
 * before any network call, a right one waits on Supabase. That is a
 * hundred-millisecond tell against a five-millisecond rejection, and it
 * turns "the ID is not a secret" from a design statement into a fact an
 * attacker can confirm without guessing.
 *
 * 600ms is above the round trip to Supabase's auth server from Vercel's
 * default region, so the real call finishes inside the floor rather than
 * poking out the far side of it. It also throttles guessing a little,
 * though that is a side effect and not the argument — Supabase's own rate
 * limiting is what actually stands between this form and a brute force.
 */
const MINIMUM_FAILURE_MS = 600;

/** Deliberately identical for a wrong ID and a wrong password. */
const SIGN_IN_REJECTED = "That admin ID and password combination isn't right.";

async function settleAt(startedAt: number): Promise<void> {
  const remaining = MINIMUM_FAILURE_MS - (Date.now() - startedAt);
  if (remaining > 0) {
    await new Promise((resolve) => setTimeout(resolve, remaining));
  }
}

async function rejected(
  startedAt: number,
  message: string,
  values?: Record<string, string>,
): Promise<AdminAuthFormState> {
  await settleAt(startedAt);
  return { status: "error", message, values };
}

/**
 * Signs in to the admin account behind the ID typed on /admin/login.
 *
 * The password goes straight to Supabase. Nothing in this codebase hashes
 * it, stores it or compares it — Supabase holds it bcrypt-hashed, checks
 * it in constant time, rate-limits the attempt and screens it against the
 * breached-password corpus. The ID is a lookup, not a second secret.
 *
 * What comes back is an ordinary Supabase session, which is the entire
 * point: `is_admin()` reads `auth.uid()` out of that JWT, so every RLS
 * policy in the database keeps enforcing exactly as it does for a member
 * signing in at /login. A bespoke admin cookie would have rendered the
 * panel and filled it with nothing.
 */
export async function adminSignIn(
  _prev: AdminAuthFormState,
  formData: FormData,
): Promise<AdminAuthFormState> {
  const startedAt = Date.now();

  const raw = {
    loginId: String(formData.get("loginId") ?? ""),
    password: String(formData.get("password") ?? ""),
  };

  const parsed = adminSignInSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      status: "error",
      fieldErrors: fieldErrorsFrom(parsed.error),
      values: { loginId: raw.loginId },
    };
  }

  const { ADMIN_LOGIN_ID, ADMIN_LOGIN_EMAIL } = serverEnv();
  const resolved = resolveAdminLogin(parsed.data.loginId, {
    id: ADMIN_LOGIN_ID,
    email: ADMIN_LOGIN_EMAIL,
  });

  if (!resolved.ok) {
    /**
     * "Not configured" is reported honestly rather than folded into the
     * rejection. It is not a credential leak — it says a deploy is
     * incomplete, which is true whoever is reading it — and hiding it
     * would leave the owner typing a correct password into a form that
     * can only ever refuse it, with nothing on screen to explain why.
     */
    if (resolved.reason === "unconfigured") {
      return rejected(
        startedAt,
        "Admin sign-in isn't configured on this deployment yet. ADMIN_LOGIN_EMAIL needs to be set.",
        { loginId: parsed.data.loginId },
      );
    }
    return rejected(startedAt, SIGN_IN_REJECTED, {
      loginId: parsed.data.loginId,
    });
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email: resolved.email,
    password: parsed.data.password,
  });

  if (error || !data.user) {
    /**
     * The one case worth distinguishing. An unconfirmed account rejects
     * every correct password forever, and "that combination isn't right"
     * would send the owner off to reset a password that was never wrong.
     */
    if (error?.message === "Email not confirmed") {
      return rejected(
        startedAt,
        "The admin account hasn't been confirmed yet. Confirm it in Supabase — Authentication → Users — and try again.",
        { loginId: parsed.data.loginId },
      );
    }
    return rejected(startedAt, SIGN_IN_REJECTED, {
      loginId: parsed.data.loginId,
    });
  }

  /**
   * The account signed in, but is it actually an admin?
   *
   * Asked through the session we just created, so the answer comes from
   * `admins_read_for_admins` — the same policy that governs the panel —
   * rather than from anything this file believes. Without it, an
   * ADMIN_LOGIN_EMAIL pointing at an account nobody added to `admins`
   * would sign in cleanly and then 404 at /admin, which looks like the
   * panel is broken rather than like the setup is one INSERT short.
   *
   * Signed back out on failure. Leaving the session behind would hand a
   * member's session to whoever typed the admin ID.
   */
  const { data: adminRow } = await supabase
    .from("admins")
    .select("user_id")
    .eq("user_id", data.user.id)
    .maybeSingle();

  if (!adminRow) {
    await supabase.auth.signOut();
    return rejected(
      startedAt,
      "That account isn't an admin. Add its user ID to the admins table and try again.",
      { loginId: parsed.data.loginId },
    );
  }

  /**
   * Write the display cookie here, not only in the proxy. `redirect()` in
   * a Server Action is completed by Next's client router, which can
   * satisfy it from cache without ever issuing the request the proxy would
   * have run on — the bug documented at length in lib/auth/actions.ts.
   */
  const store = await cookies();
  store.set({
    name: MEMBER_COOKIE,
    value: encodeMember(memberDisplayFrom(data.user)),
    ...memberCookieOptions(MEMBER_COOKIE_MAX_AGE),
  });

  revalidatePath("/", "layout");
  // Outside every try/catch above: redirect() signals by throwing, and a
  // catch that swallowed it would turn a successful sign-in into a blank
  // form with no error on it.
  //
  // The proxy attaches `next` when it turns a signed-out visitor away from
  // a panel URL, so a bookmark of /admin/members returns there instead of
  // landing on the overview. safeAdminNext refuses anything outside the
  // panel — see its header.
  redirect(safeAdminNext(formData.get("next")));
}

/**
 * Confirms the current password by using it.
 *
 * There is no stored hash to compare against — Supabase has it and does
 * not hand it back — so possession is proved the only way it can be, by
 * signing in with it. Returns the confirmed account's email, or null.
 *
 * Harmless to the live session: it authenticates the same user, so the
 * cookies it refreshes are the ones already there. A wrong password
 * fails without touching them.
 */
async function confirmCurrentPassword(
  email: string,
  password: string,
): Promise<boolean> {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  return !error && data.user !== null;
}

/**
 * The signed-in admin, or null. Both password steps need it and neither
 * may proceed without it.
 */
async function currentAdminEmail(): Promise<string | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) return null;

  const { data } = await supabase
    .from("admins")
    .select("user_id")
    .eq("user_id", user.id)
    .maybeSingle();

  return data ? user.email : null;
}

/**
 * Step one of a password change: prove the current password, then have
 * Supabase email a confirmation code.
 *
 * `reauthenticate()` is the purpose-built call — the mail it sends is the
 * reauthentication template, which says a password change is being
 * confirmed, rather than a magic link that says someone is signing in.
 * The code it mints is consumed by `updateUser({ nonce })` in step two.
 *
 * Nothing about the new password is stored between the steps. It stays in
 * the browser form and is submitted again with the code, so there is no
 * server-side pending-change record to expire, leak or get stuck.
 */
async function sendAdminPasswordCode(
  _prev: AdminPasswordState,
  formData: FormData,
): Promise<AdminPasswordState> {
  const raw = {
    currentPassword: String(formData.get("currentPassword") ?? ""),
    newPassword: String(formData.get("newPassword") ?? ""),
    confirmPassword: String(formData.get("confirmPassword") ?? ""),
  };

  const parsed = adminPasswordRequestSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      status: "error",
      step: "choose",
      fieldErrors: fieldErrorsFrom(parsed.error),
    };
  }

  const email = await currentAdminEmail();
  if (!email) {
    return {
      status: "error",
      step: "choose",
      message: "Your admin session has expired. Sign in again to continue.",
    };
  }

  if (!(await confirmCurrentPassword(email, parsed.data.currentPassword))) {
    return {
      status: "error",
      step: "choose",
      fieldErrors: { currentPassword: "That isn't the current password" },
    };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.reauthenticate();

  if (error) {
    /**
     * Supabase's built-in mailer is rate-limited per hour, and on the free
     * tier the ceiling is low enough to hit by trying twice. Saying so is
     * the difference between waiting a few minutes and concluding the
     * feature is broken.
     */
    return {
      status: "error",
      step: "choose",
      message:
        "We couldn't send the code just then — Supabase limits how many emails go out per hour. Wait a few minutes and try again.",
    };
  }

  return {
    status: "success",
    step: "verify",
    message: `We've emailed a confirmation code to ${email}. Enter it below to finish the change.`,
  };
}

/**
 * Step two: the code, plus the same two passwords again.
 *
 * The current password is re-confirmed rather than trusted from step one.
 * Step one's result reaches this call as ordinary form fields, which the
 * browser can edit; re-checking costs one request and means the guarantee
 * does not rest on what the client sent back.
 */
async function changeAdminPassword(
  _prev: AdminPasswordState,
  formData: FormData,
): Promise<AdminPasswordState> {
  const raw = {
    currentPassword: String(formData.get("currentPassword") ?? ""),
    newPassword: String(formData.get("newPassword") ?? ""),
    confirmPassword: String(formData.get("confirmPassword") ?? ""),
    code: String(formData.get("code") ?? ""),
  };

  const parsed = adminPasswordConfirmSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      status: "error",
      step: "verify",
      fieldErrors: fieldErrorsFrom(parsed.error),
    };
  }

  const email = await currentAdminEmail();
  if (!email) {
    return {
      status: "error",
      step: "choose",
      message: "Your admin session has expired. Sign in again to continue.",
    };
  }

  if (!(await confirmCurrentPassword(email, parsed.data.currentPassword))) {
    return {
      status: "error",
      step: "verify",
      fieldErrors: { currentPassword: "That isn't the current password" },
    };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({
    password: parsed.data.newPassword,
    nonce: parsed.data.code,
  });

  if (error) {
    const message = error.message.toLowerCase();

    if (message.includes("nonce")) {
      return {
        status: "error",
        step: "verify",
        fieldErrors: {
          code: "That code is wrong or has expired. Start again to get a new one.",
        },
      };
    }

    /**
     * Supabase refuses a password that appears in the HaveIBeenPwned
     * corpus when leaked-password protection is on, and refuses one under
     * the project's minimum length or character policy. Both arrive here,
     * and both are about the new password rather than the code.
     */
    if (message.includes("password")) {
      return {
        status: "error",
        step: "verify",
        fieldErrors: {
          newPassword: error.message,
        },
      };
    }

    return {
      status: "error",
      step: "verify",
      message: "That change didn't go through. Please try again.",
    };
  }

  /**
   * The session survives its own password change — Supabase reissues the
   * tokens on this client — so the admin stays signed in and lands back on
   * step one with a confirmation rather than at the login page.
   */
  return {
    status: "success",
    step: "choose",
    message:
      "Password changed. Use the new one the next time you sign in at /admin/login.",
  };
}

/**
 * The only exported entry point for a password change.
 *
 * Both halves are reached through one action so the form can hold one
 * `useActionState` and therefore one idea of which step it is on. Two
 * hooks would mean two states, and the failure that produces is a screen
 * showing the code field with the previous step's error still under it.
 *
 * Every exported function in a "use server" file is a public endpoint, so
 * the two step handlers are deliberately not exported: it leaves one door
 * to reason about instead of three, and the step is chosen here rather
 * than by whichever one the caller picked.
 *
 * Anything that is not exactly "verify" requests a code. An unrecognised
 * or absent intent therefore cannot apply a change — the failure mode of
 * a malformed submission is an unnecessary email, not an unverified
 * password change.
 */
export async function submitAdminPassword(
  prev: AdminPasswordState,
  formData: FormData,
): Promise<AdminPasswordState> {
  return String(formData.get("intent") ?? "") === "verify"
    ? changeAdminPassword(prev, formData)
    : sendAdminPasswordCode(prev, formData);
}
