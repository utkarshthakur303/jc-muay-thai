import Link from "next/link";

import { getUser } from "@/lib/supabase/server";

/**
 * Placeholder home page. The full bento-grid port from the approved mockup
 * replaces this — it exists now only so the auth screens have somewhere to
 * link back to.
 */
export default async function HomePage() {
  const user = await getUser();

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-8 px-6 text-center">
      <div>
        <p className="font-mono text-xs uppercase tracking-[0.16em] text-accent">
          Muay Thai — Jersey City
        </p>
        <h1 className="mt-3 font-display text-6xl tracking-wide text-text sm:text-7xl">
          JC MUAYTHAI
        </h1>
        <p className="mt-4 text-sm text-text-2">
          Home page port in progress. Auth screens are ready to review.
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-3">
        {user ? (
          <Link
            href="/account"
            className="flex min-h-12 items-center rounded-full bg-accent px-7 font-mono text-[13px] font-semibold tracking-[0.08em] text-[#0B0B0C] transition-colors hover:bg-accent-hover"
          >
            Your Account
          </Link>
        ) : (
          <>
            <Link
              href="/login"
              className="flex min-h-12 items-center rounded-full bg-accent px-7 font-mono text-[13px] font-semibold tracking-[0.08em] text-[#0B0B0C] transition-colors hover:bg-accent-hover"
            >
              Sign In
            </Link>
            <Link
              href="/signup"
              className="flex min-h-12 items-center rounded-full border border-border px-7 font-mono text-[13px] font-semibold tracking-[0.08em] text-text transition-colors hover:border-accent"
            >
              Create Account
            </Link>
          </>
        )}
      </div>
    </main>
  );
}
