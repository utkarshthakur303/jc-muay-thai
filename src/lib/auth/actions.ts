"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import {
  MEMBER_COOKIE,
  MEMBER_COOKIE_MAX_AGE,
  encodeMember,
  memberCookieOptions,
  memberDisplayFrom,
} from "@/lib/auth/memberCookie";
import { safeNextPath } from "@/lib/auth/redirects";
import { fieldErrorsFrom } from "@/lib/validation/fields";
import {
  forgotPasswordSchema,
  setPasswordSchema,
  signInSchema,
  signUpSchema,
  type AuthFormState,
} from "@/lib/validation/auth";

/**
 * Builds an absolute URL for auth redirects from the incoming request's
 * own origin rather than a hardcoded env value, so preview deployments,
 * localhost and production all work without reconfiguration.
 *
 * Every origin used here must also appear in Supabase's redirect
 * allow-list (Authentication -> URL Configuration) or the link silently
 * fails. See SETUP-AUTH.md.
 */
async function getOrigin(): Promise<string> {
  const headerList = await headers();
  const origin = headerList.get("origin");
  if (origin) return origin;

  const host = headerList.get("host") ?? "localhost:3000";
  const protocol = host.startsWith("localhost") ? "http" : "https";
  return `${protocol}://${host}`;
}

/** The open-redirect guard and the default destination both live in
 *  lib/auth/redirects.ts, because the login and sign-up pages need the
 *  same rule and a rule written twice drifts. */
const safeNext = safeNextPath;

export async function signIn(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const raw = {
    email: String(formData.get("email") ?? ""),
    password: String(formData.get("password") ?? ""),
  };

  const parsed = signInSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      status: "error",
      fieldErrors: fieldErrorsFrom(parsed.error),
      values: { email: raw.email },
    };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword(parsed.data);

  if (error) {
    /**
     * Deliberately generic. Distinguishing "no such account" from "wrong
     * password" lets an attacker enumerate which emails are registered
     * members of the gym.
     */
    return {
      status: "error",
      message:
        error.message === "Email not confirmed"
          ? "Please confirm your email address first — check your inbox for the link we sent."
          : "That email and password combination isn't right.",
      values: { email: parsed.data.email },
    };
  }

  /**
   * Write the display cookie here, not only in the proxy.
   *
   * This was a real bug, and the reasoning that produced it is worth
   * recording. The proxy reconciles this cookie on every request, so it
   * looked as though a redirect to "/" would pick it up on the way. It does
   * not: `redirect()` in a Server Action is completed by Next's *client*
   * router, which can satisfy it from its own cache without ever issuing
   * the request the proxy would have run on. The member was signed in, and
   * the top bar went on saying "Sign in" until they happened to trigger a
   * full page load.
   *
   * The rule this leaves behind: the moment identity changes is the moment
   * to write it down. Reconciling later is a safety net, not a mechanism.
   */
  if (data.user) {
    const store = await cookies();
    store.set({
      name: MEMBER_COOKIE,
      value: encodeMember(memberDisplayFrom(data.user)),
      ...memberCookieOptions(MEMBER_COOKIE_MAX_AGE),
    });
  }

  // The home page carries no session-dependent server render, but /account
  // and /book do, and both are reachable from here without a fresh load.
  revalidatePath("/", "layout");
  redirect(safeNext(formData.get("next")));
}

export async function signUp(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const raw = {
    fullName: String(formData.get("fullName") ?? ""),
    email: String(formData.get("email") ?? ""),
    password: String(formData.get("password") ?? ""),
  };

  const parsed = signUpSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      status: "error",
      fieldErrors: fieldErrorsFrom(parsed.error),
      values: { fullName: raw.fullName, email: raw.email },
    };
  }

  const supabase = await createClient();
  const origin = await getOrigin();

  /**
   * The destination survives the round trip through the inbox.
   *
   * Someone who pressed "Book your trial class" without an account travels
   * /book → /login → /signup → their email → back here. If `next` were
   * dropped anywhere on that journey they would confirm their address and
   * land on the home page, having forgotten why they signed up. This is the
   * only leg where it has to survive outside the browser, so it rides on
   * the confirmation link.
   */
  const next = safeNext(formData.get("next"));

  const { error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      emailRedirectTo: `${origin}/auth/callback?next=${encodeURIComponent(next)}`,
      data: { full_name: parsed.data.fullName },
    },
  });

  if (error) {
    return {
      status: "error",
      message:
        error.status === 429
          ? "Too many attempts. Please wait a minute and try again."
          : "We couldn't create that account. Please try again.",
      values: { fullName: parsed.data.fullName, email: parsed.data.email },
    };
  }

  /**
   * Success is reported identically whether or not the address was already
   * registered — Supabase returns a fake user object in that case for
   * exactly this reason. Saying "that email is taken" would leak membership.
   */
  return {
    status: "success",
    message: `Check ${parsed.data.email} for a link to confirm your account.`,
  };
}

export async function signInWithGoogle(formData: FormData): Promise<void> {
  const supabase = await createClient();
  const origin = await getOrigin();
  const next = safeNext(formData.get("next"));

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${origin}/auth/callback?next=${encodeURIComponent(next)}`,
      queryParams: { access_type: "offline", prompt: "consent" },
    },
  });

  if (error || !data.url) {
    redirect("/login?error=oauth");
  }

  redirect(data.url);
}

export async function requestPasswordReset(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const parsed = forgotPasswordSchema.safeParse({
    email: String(formData.get("email") ?? ""),
  });

  if (!parsed.success) {
    return { status: "error", fieldErrors: fieldErrorsFrom(parsed.error) };
  }

  const supabase = await createClient();
  const origin = await getOrigin();

  await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${origin}/auth/callback?next=/account/password`,
  });

  // Always report success, even for unregistered addresses — otherwise this
  // endpoint becomes an account-enumeration oracle.
  return {
    status: "success",
    message: `If an account exists for ${parsed.data.email}, a reset link is on its way.`,
  };
}

export async function signOut(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();

  // Cleared here for the same reason it is set in signIn: the redirect
  // below may never reach the proxy. Without this the account chip can
  // outlive the session on screen, which is the more alarming direction of
  // the same bug — it tells someone they are still signed in.
  const store = await cookies();
  store.set({ name: MEMBER_COOKIE, value: "", ...memberCookieOptions(0) });

  revalidatePath("/", "layout");
  redirect("/");
}

/**
 * Finishes a password reset.
 *
 * THIS IS THE OTHER HALF OF A FLOW THAT SHIPPED WITHOUT ONE. Recovery
 * emails have always pointed at /account/password, and that page did not
 * exist, so every reset link verified the visitor, signed them in, and
 * dropped them on a 404. The session was real and the password was never
 * changed — which looks, to the person holding the email, exactly like a
 * reset that worked, right up until the old password fails again.
 *
 * Authorisation is the session and nothing else, and that is not an
 * oversight. Whoever is here either opened a link sent to their own inbox
 * or is already signed in. Asking for the current password would make the
 * page useless to the only people who need it.
 *
 * No redirect on success. A reset arriving from an expired link is common
 * enough that the difference between "done" and "the link had run out"
 * must be visible on the page rather than inferred from where the browser
 * ended up.
 */
export async function setPassword(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const parsed = setPasswordSchema.safeParse({
    password: String(formData.get("password") ?? ""),
    confirmPassword: String(formData.get("confirmPassword") ?? ""),
  });

  if (!parsed.success) {
    return { status: "error", fieldErrors: fieldErrorsFrom(parsed.error) };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      status: "error",
      message:
        "That reset link has expired or has already been used. Request a new one and try again.",
    };
  }

  const { error } = await supabase.auth.updateUser({
    password: parsed.data.password,
  });

  if (error) {
    /**
     * Supabase refuses a password under the project's minimum length, one
     * that appears in the breached-password corpus, and one identical to
     * the current password. All three are about this field and all three
     * are worth repeating verbatim — they say something specific and
     * actionable that a generic message would throw away.
     */
    return { status: "error", fieldErrors: { password: error.message } };
  }

  // The top bar and /account both render from the session; the password
  // change reissues it, so anything holding the old one must re-read.
  revalidatePath("/", "layout");

  return {
    status: "success",
    message: "Password saved. You can use it to sign in from now on.",
  };
}
