import Link from "next/link";

/**
 * The site's one conversion action.
 *
 * The mockup's equivalent buttons opened a drawer that listed class times
 * but could not book anything — three separate controls, none of which did
 * what they said. Until the booking flow exists, this points at the real
 * funnel that does: create an account, then book. Nothing on this page
 * promises an action the site cannot complete.
 *
 * The destination is fixed rather than branched on the visitor's session,
 * which is what keeps the home page static. A member who is already signed
 * in and taps this is redirected to /account by the proxy, so the single
 * destination stays correct for everyone without the page having to ask
 * Supabase who is asking.
 *
 * When booking ships, this becomes /book (and /login?next=/book for
 * signed-out visitors). It is the only place either changes.
 */
export function PrimaryCta({
  label = "Book free class",
  className = "",
}: {
  label?: string;
  className?: string;
}) {
  return (
    <Link
      href="/signup"
      className={`flex min-h-11 items-center justify-center rounded-full bg-accent px-6 font-mono text-[12px] font-semibold tracking-[0.08em] text-ink transition-colors hover:bg-accent-hover ${className}`}
    >
      {label}
    </Link>
  );
}
