import type { Metadata } from "next";
import Link from "next/link";

import { AuthShell } from "@/components/auth/AuthShell";
import { ForgotPasswordForm } from "@/components/auth/ForgotPasswordForm";
import { ConfigNotice } from "@/components/auth/ConfigNotice";

export const metadata: Metadata = {
  title: "Reset Password",
  robots: { index: false, follow: false },
};

export default function ForgotPasswordPage() {
  return (
    <AuthShell
      eyebrow="Members"
      heading="RESET PASSWORD"
      subheading="Enter your email and we'll send you a link to set a new password."
      footer={
        <p>
          Remembered it?{" "}
          <Link
            href="/login"
            className="font-medium text-accent underline-offset-4 hover:underline"
          >
            Back to sign in
          </Link>
        </p>
      }
    >
      <ConfigNotice />
      <ForgotPasswordForm />
    </AuthShell>
  );
}
