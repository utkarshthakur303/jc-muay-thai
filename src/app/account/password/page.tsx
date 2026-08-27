import Link from "next/link";

import { AuthShell } from "@/components/auth/AuthShell";
import { SetPasswordForm } from "@/components/auth/SetPasswordForm";
import { getUser } from "@/lib/supabase/server";

/**
 * Where every password-reset email has always pointed, and what was never
 * built until now.
 *
 * `resetPasswordForEmail` sends people to /auth/callback?next=/account/password.
 * The callback verified the link, created a session and redirected here —
 * to a 404. The visitor was signed in and their password was unchanged,
 * which is indistinguishable from a successful reset until the old
 * password fails again. That is how the gym owner's account ended up with
 * an email identity nobody could sign in with.
 *
 * Uses AuthShell rather than MemberShell despite the /account path. Someone
 * arriving from a reset link is mid-authentication, not browsing their
 * membership, and the member tabs would offer three ways to wander off
 * before finishing the one thing they came to do.
 *
 * The route sits under /account, so the proxy's protected-prefix check
 * already requires a session — an expired link never reaches this page, it
 * is turned away at /login with an explanation.
 */
export const metadata = {
  title: "Set a Password",
  robots: { index: false, follow: false },
};

export default async function SetPasswordPage() {
  const user = await getUser();

  return (
    <AuthShell
      eyebrow="Members"
      heading="SET A PASSWORD"
      subheading={
        user?.email
          ? `Choose a password for ${user.email}. You'll use it to sign in from now on.`
          : "Choose a password. You'll use it to sign in from now on."
      }
      footer={
        <p>
          Changed your mind?{" "}
          <Link
            href="/account"
            className="font-medium text-accent-strong underline-offset-4 hover:underline"
          >
            Back to your account
          </Link>
          .
        </p>
      }
    >
      <SetPasswordForm />
    </AuthShell>
  );
}
