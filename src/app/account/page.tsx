import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { getUser } from "@/lib/supabase/server";
import { signOut } from "@/lib/auth/actions";

export const metadata: Metadata = {
  title: "Your Account",
  robots: { index: false, follow: false },
};

export default async function AccountPage() {
  const user = await getUser();

  /**
   * The proxy already guards this route, but a Server Component must not
   * rely on that alone — a misconfigured matcher would silently expose the
   * page. Authorisation is checked where the data is read.
   */
  if (!user) redirect("/login?next=/account");

  const fullName =
    (user.user_metadata?.full_name as string | undefined) ??
    (user.user_metadata?.name as string | undefined) ??
    null;

  return (
    <main className="mx-auto w-full max-w-2xl px-5 py-16 sm:px-8">
      <Link
        href="/"
        className="font-mono text-[11px] uppercase tracking-[0.1em] text-text-2 transition-colors hover:text-accent"
      >
        ← Back to site
      </Link>

      <h1 className="mt-6 font-display text-5xl tracking-wide text-text">
        YOUR ACCOUNT
      </h1>

      <dl className="mt-10 divide-y divide-divider rounded-[24px] border border-border bg-card">
        <div className="flex items-center justify-between gap-4 px-6 py-5">
          <dt className="font-mono text-[11px] uppercase tracking-[0.1em] text-text-2">
            Name
          </dt>
          <dd className="text-sm text-text">{fullName ?? "Not set"}</dd>
        </div>
        <div className="flex items-center justify-between gap-4 px-6 py-5">
          <dt className="font-mono text-[11px] uppercase tracking-[0.1em] text-text-2">
            Email
          </dt>
          <dd className="text-sm text-text">{user.email}</dd>
        </div>
        <div className="flex items-center justify-between gap-4 px-6 py-5">
          <dt className="font-mono text-[11px] uppercase tracking-[0.1em] text-text-2">
            Signed in with
          </dt>
          <dd className="text-sm capitalize text-text">
            {user.app_metadata?.provider ?? "email"}
          </dd>
        </div>
      </dl>

      <p className="mt-8 text-sm leading-relaxed text-text-2">
        Class booking lands here next — upcoming classes, one-tap cancellation,
        and your training history.
      </p>

      <form action={signOut} className="mt-8">
        <button
          type="submit"
          className="min-h-11 rounded-full border border-border px-6 font-mono text-[12px] uppercase tracking-[0.08em] text-text-2 transition-colors hover:border-crimson hover:text-crimson"
        >
          Sign out
        </button>
      </form>
    </main>
  );
}
