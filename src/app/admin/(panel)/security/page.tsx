import { AdminShell } from "@/components/admin/AdminShell";
import { AdminPasswordForm } from "@/components/admin/AdminPasswordForm";
import { Alert } from "@/components/ui/Alert";
import { requireAdmin } from "@/lib/admin/guard";
import { serverEnv } from "@/lib/env.server";
import { DEFAULT_ADMIN_LOGIN_ID, normaliseLoginId } from "@/lib/admin/loginId";

/**
 * The admin account's own credentials.
 *
 * The password changed here is the Supabase account's real password —
 * the same string typed at /admin/login — because that is what makes the
 * email confirmation below possible at all. Supabase can mail a
 * reauthentication code for its own account; it has no way to mail one
 * for a password this codebase invented and stored itself.
 */
export const metadata = { title: "Security" };

export default async function AdminSecurityPage() {
  const user = await requireAdmin();

  const { ADMIN_LOGIN_ID, ADMIN_LOGIN_EMAIL } = serverEnv();
  const loginId = normaliseLoginId(ADMIN_LOGIN_ID ?? DEFAULT_ADMIN_LOGIN_ID);

  /**
   * Whose password is actually about to change.
   *
   * This form acts on the session, and the session is not necessarily the
   * account /admin/login uses. An owner signed in at /login with his own
   * email is a full admin and reaches this page legitimately — and would
   * change *his* password while believing he had changed the panel's.
   *
   * The two are compared case-insensitively because an email address that
   * differs only in case is the same mailbox, and flagging that as a
   * mismatch would be a warning about nothing.
   */
  const configured = ADMIN_LOGIN_EMAIL?.trim().toLowerCase() ?? null;
  const signedInAs = user.email?.trim().toLowerCase() ?? null;
  const actingOnPanelAccount =
    configured !== null && signedInAs !== null && configured === signedInAs;

  return (
    <AdminShell
      current="/admin/security"
      heading="Security"
      lead="The ID and password used to sign in at the admin door."
    >
      <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)] lg:items-start">
        <section className="rounded-card border border-border bg-card px-5 py-6 sm:px-7">
          <h2 className="font-display text-2xl tracking-wide text-text">
            CHANGE PASSWORD
          </h2>
          {/*
            SAYS ONLY WHAT IT CAN GUARANTEE.

            This used to read "the change only happens once that code comes
            back", which is a promise about the server, and the server does
            not keep it unless "Secure password change" is enabled on the
            Supabase project. With that setting off, GoTrue ignores the
            nonce whenever the session is recent — and step one signs in to
            verify the current password, so the session is always seconds
            old by the time the change is submitted. A wrong code would go
            through.

            The check that always holds is the current password, verified
            here in both steps by using it. So the copy leads with that and
            describes the code as a step rather than as a lock.
          */}
          <p className="mt-2 max-w-prose text-sm leading-relaxed text-text-2">
            Two steps, and both need the password you use now. Choose the new
            one, and we&rsquo;ll email a code to the admin account for you to
            enter before it takes effect.
          </p>

          {ADMIN_LOGIN_EMAIL === undefined ? (
            <div className="mt-5">
              <Alert tone="warning">
                <strong className="font-semibold">
                  The admin door isn&rsquo;t configured yet.
                </strong>{" "}
                <code className="font-mono text-[13px]">ADMIN_LOGIN_EMAIL</code>{" "}
                is unset, so nobody can sign in at{" "}
                <code className="font-mono text-[13px]">/admin/login</code>. You
                can still change your own password below.
              </Alert>
            </div>
          ) : null}

          {ADMIN_LOGIN_EMAIL !== undefined && !actingOnPanelAccount ? (
            <div className="mt-5">
              <Alert tone="warning">
                <strong className="font-semibold">
                  This changes your own password, not the admin door&rsquo;s.
                </strong>{" "}
                You&rsquo;re signed in as{" "}
                <span className="font-mono text-[13px]">{user.email}</span>, but{" "}
                <code className="font-mono text-[13px]">/admin/login</code> signs
                into a different account. To change the password that door uses,
                sign in through it first.
              </Alert>
            </div>
          ) : null}

          <AdminPasswordForm />
        </section>

        <aside className="rounded-card border border-border bg-card px-5 py-6 sm:px-7">
          <h2 className="font-mono text-[11px] tracking-[0.12em] text-text-2 uppercase">
            The admin door
          </h2>

          <dl className="mt-4 flex flex-col gap-4">
            <div>
              <dt className="text-xs text-text-2">Address</dt>
              <dd className="mt-1 font-mono text-sm text-text">/admin/login</dd>
            </div>
            <div>
              <dt className="text-xs text-text-2">ID</dt>
              <dd className="mt-1 font-mono text-sm text-text">{loginId}</dd>
            </div>
            <div>
              <dt className="text-xs text-text-2">Signed in as</dt>
              <dd className="mt-1 font-mono text-sm break-all text-text">
                {user.email ?? "—"}
              </dd>
            </div>
          </dl>

          {/*
            Said here rather than left to be discovered. The ID is one
            half of a credential and the half that is allowed to be
            guessable — the footer link tells everyone where the door is,
            and that is fine. What is not fine is assuming the ID is doing
            protective work it is not doing.
          */}
          <p className="mt-5 border-t border-divider pt-4 text-sm leading-relaxed text-text-2">
            The ID is not a secret — the whole password does the work. Anyone
            can reach the door from the footer link; nobody gets through it
            without the password.
          </p>

          {/*
            ONE ACCOUNT, ONE PASSWORD, TWO DOORS.

            The ID is an alias for an email address, not a second identity,
            so changing the password here changes it everywhere that account
            signs in. Worth saying out loud: someone who thinks of "the
            admin password" and "my password" as two things will otherwise
            find the member form rejecting them and read it as a fault.
          */}
          <p className="mt-4 text-sm leading-relaxed text-text-2">
            The ID is an alias for this account&rsquo;s email address, not a
            second login. Changing the password changes it for both doors —
            here with the ID, and at{" "}
            <span className="font-mono text-[13px]">/login</span> with the
            email.
          </p>
        </aside>
      </div>
    </AdminShell>
  );
}
