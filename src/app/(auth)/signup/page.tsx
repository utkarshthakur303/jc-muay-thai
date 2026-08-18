import type { Metadata } from "next";
import Link from "next/link";

import { AuthShell } from "@/components/auth/AuthShell";
import { GoogleButton } from "@/components/auth/GoogleButton";
import { SignUpForm } from "@/components/auth/SignUpForm";
import { ConfigNotice } from "@/components/auth/ConfigNotice";
import { Divider } from "@/components/ui/Divider";
import { safeNextPath, withNext } from "@/lib/auth/redirects";

export const metadata: Metadata = {
  title: "Create Account",
  description: "Create a JC Muay Thai account to book classes.",
  robots: { index: false, follow: false },
};

export default async function SignUpPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const next = safeNextPath(params.next);

  return (
    <AuthShell
      eyebrow="Join the gym"
      heading="CREATE ACCOUNT"
      subheading="One account to book classes, cancel a spot, and keep track of your training."
      footer={
        <p>
          Already a member?{" "}
          <Link
            // Carries the destination across, so someone who came here to
            // book and then realised they already have an account is not
            // dropped on the home page after signing in.
            href={withNext("/login", next)}
            className="font-medium text-accent-strong underline-offset-4 hover:underline"
          >
            Sign in
          </Link>
        </p>
      }
    >
      <ConfigNotice />

      <div className="flex flex-col gap-6">
        <GoogleButton label="Sign up with Google" next={next} />
        <Divider>or sign up with email</Divider>
        <SignUpForm next={next} />

        <p className="text-xs leading-relaxed text-text-3">
          By creating an account you agree to our{" "}
          <Link
            href="/terms"
            className="text-text-2 underline underline-offset-4"
          >
            Terms
          </Link>{" "}
          and{" "}
          <Link
            href="/privacy"
            className="text-text-2 underline underline-offset-4"
          >
            Privacy Policy
          </Link>
          .
        </p>
      </div>
    </AuthShell>
  );
}
