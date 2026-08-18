import type { Metadata } from "next";
import Link from "next/link";

import { AuthShell } from "@/components/auth/AuthShell";
import { GoogleButton } from "@/components/auth/GoogleButton";
import { LoginForm } from "@/components/auth/LoginForm";
import { Alert } from "@/components/ui/Alert";
import { Divider } from "@/components/ui/Divider";
import { ConfigNotice } from "@/components/auth/ConfigNotice";
import { safeNextPath, withNext } from "@/lib/auth/redirects";

export const metadata: Metadata = {
  title: "Sign In",
  description: "Sign in to book classes at JC Muay Thai.",
  robots: { index: false, follow: false },
};

const ERROR_MESSAGES: Record<string, string> = {
  oauth: "We couldn't reach Google just then. Please try again.",
  cancelled: "Google sign-in was cancelled.",
  link: "That link has expired or has already been used. Request a new one below.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;

  // Shared with the sign-in action and the sign-up page, so the three
  // cannot disagree about what counts as a safe destination.
  const next = safeNextPath(params.next);

  const errorKey = typeof params.error === "string" ? params.error : null;
  const errorMessage = errorKey ? ERROR_MESSAGES[errorKey] : null;

  return (
    <AuthShell
      eyebrow="Members"
      heading="WELCOME BACK"
      subheading="Sign in to book classes, manage your spot, and see your training history."
      footer={
        <p>
          New here?{" "}
          <Link
            // The whole reason /book works for a first-time visitor: the
            // proxy sends them here with ?next=/book, and this carries it
            // through sign-up and out the other side of the confirmation
            // email.
            href={withNext("/signup", next)}
            className="font-medium text-accent-strong underline-offset-4 hover:underline"
          >
            Create an account
          </Link>{" "}
          — start with a two-week trial.
        </p>
      }
    >
      <ConfigNotice />

      <div className="flex flex-col gap-6">
        {errorMessage ? <Alert tone="error">{errorMessage}</Alert> : null}

        <GoogleButton next={next} />

        <Divider>or continue with email</Divider>

        <LoginForm next={next} />
      </div>
    </AuthShell>
  );
}
