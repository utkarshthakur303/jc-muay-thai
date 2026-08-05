"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { fieldErrorsFrom } from "@/lib/validation/fields";
import {
  forgotPasswordSchema,
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

/**
 * Only allow relative, single-slash paths as a post-login destination.
 * Without this check, `?next=https://evil.example` would turn the login
 * page into an open redirect.
 */
function safeNext(value: FormDataEntryValue | null): string {
  if (typeof value !== "string") return "/account";
  if (!value.startsWith("/") || value.startsWith("//")) return "/account";
  return value;
}

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
  const { error } = await supabase.auth.signInWithPassword(parsed.data);

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

  const { error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      emailRedirectTo: `${origin}/auth/callback`,
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
  revalidatePath("/", "layout");
  redirect("/");
}
