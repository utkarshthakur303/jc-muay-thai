import Link from "next/link";
import { redirect } from "next/navigation";

import { AdminLoginForm } from "@/components/admin/AdminLoginForm";
import { AuthShell } from "@/components/auth/AuthShell";
import { Alert } from "@/components/ui/Alert";
import { isAdmin } from "@/lib/admin/guard";
import { safeAdminNext } from "@/lib/admin/loginId";
import { getUser } from "@/lib/supabase/server";

/**
 * The staff door.
 *
 * Sits outside the `(panel)` route group precisely so the guard on that
 * group cannot reach it — a sign-in page behind a sign-in check is a
 * redirect loop with extra steps. See admin/layout.tsx for why the group
 * exists at all.
 *
 * `noindex` is inherited from admin/layout.tsx. It keeps the page out of
 * search results and is not pretending to be a security control: the
 * footer links here from every page on the site, so this URL is public
 * knowledge by design. What protects the panel is the password, Supabase's
 * rate limiting, and the RLS policies behind both.
 */
export const metadata = { title: "Admin Sign In" };

export default async function AdminLoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;

  /**
   * Sanitised here as well as in the action. The action's copy is the one
   * that protects the redirect; this one keeps a rejected value from being
   * written into the form's hidden field, so what the page shows and what
   * the action would do cannot disagree.
   */
  const next = safeAdminNext(params.next);

  const user = await getUser();

  /**
   * Already an admin — nothing to do here. Sending them to the form and
   * making them type a password they have already proved is the kind of
   * small rudeness that gets a bookmark saved one level deeper.
   */
  if (user && (await isAdmin())) redirect("/admin");

  /**
   * Signed in, but as a member. Not turned away — the gym owner may well
   * be signed in on his own account when he needs the panel — but told
   * what is about to happen, because signing in below replaces the session
   * he is currently browsing with.
   */
  const signedInAs = user?.email ?? null;

  return (
    <AuthShell
      eyebrow="Staff"
      heading="ADMIN"
      subheading="Sign in with the admin ID and password to manage classes, members and pricing."
      footer={
        <p>
          Looking for your own account?{" "}
          <Link
            href="/login"
            className="font-medium text-accent-strong underline-offset-4 hover:underline"
          >
            Member sign-in
          </Link>
          .
        </p>
      }
    >
      {signedInAs ? (
        <div className="mb-6">
          <Alert tone="warning">
            You&rsquo;re currently signed in as{" "}
            <span className="font-mono text-[13px]">{signedInAs}</span>. Signing
            in below will replace that session.
          </Alert>
        </div>
      ) : null}

      <AdminLoginForm next={next} />
    </AuthShell>
  );
}
