import type { Metadata } from "next";
import Link from "next/link";

import { AuthShell } from "@/components/auth/AuthShell";
import { GoogleButton } from "@/components/auth/GoogleButton";
import { LoginForm } from "@/components/auth/LoginForm";
import { Alert } from "@/components/ui/Alert";
import { Divider } from "@/components/ui/Divider";
import { ConfigNotice } from "@/components/auth/ConfigNotice";

export const metadata: Metadata = {
  title: "Sign In",
  description: "Sign in to book classes at JC Muaythai.",
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

  const rawNext = typeof params.next === "string" ? params.next : "";
  // Only relative paths — never let a query parameter become an open redirect.
  const next =
    rawNext.startsWith("/") && !rawNext.startsWith("//") ? rawNext : "/account";

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
            href="/signup"
            className="font-medium text-accent underline-offset-4 hover:underline"
          >
            Create an account
          </Link>{" "}
          — your first class is free.
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
