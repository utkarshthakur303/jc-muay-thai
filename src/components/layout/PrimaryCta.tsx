import Link from "next/link";

/**
 * The site's one conversion action.
 *
 * The mockup's equivalent buttons opened a drawer that listed class times
 * but could not book anything — three separate controls, none of which did
 * what they said. This one does: it goes to the booking page, and the
 * booking page books.
 *
 * The destination is fixed rather than branched on the visitor's session,
 * which is what keeps the home page static and served from the CDN. /book
 * is a protected route, so the proxy sorts out who is who: a member goes
 * straight there, and anyone else is sent to /login?next=/book and
 * returned to it the moment they have an account. The page never has to
 * ask Supabase who is asking.
 */
export function PrimaryCta({
  label = "Book your trial class",
  className = "",
}: {
  label?: string;
  className?: string;
}) {
  return (
    <Link
      href="/book"
      className={`flex min-h-11 items-center justify-center rounded-full bg-accent px-6 font-mono text-[12px] font-semibold tracking-[0.08em] text-ink transition-colors hover:bg-accent-hover ${className}`}
    >
      {label}
    </Link>
  );
}
