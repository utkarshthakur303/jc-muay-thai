import Link from "next/link";

import { site } from "@/content/site";

/**
 * Frame shared by /book and /account.
 *
 * They are two halves of one thing — what you can book, and what you have
 * booked — so they share a header and a pair of tabs rather than each
 * being an island with its own way back to the site. Declared once so the
 * two cannot drift apart visually.
 */

const TABS = [
  { href: "/book", label: "Book a class" },
  { href: "/account", label: "Your classes" },
] as const;

export function MemberShell({
  current,
  heading,
  children,
}: {
  current: "/book" | "/account";
  heading: string;
  children: React.ReactNode;
}) {
  return (
    <main className="mx-auto w-full max-w-3xl px-5 py-14 sm:px-8 lg:py-20">
      <Link
        href="/"
        className="font-mono text-[11px] tracking-widest text-text-2 uppercase transition-colors hover:text-accent-strong"
      >
        ← {site.name}
      </Link>

      <h1 className="mt-6 font-display text-4xl tracking-wide text-text sm:text-5xl">
        {heading.toUpperCase()}
      </h1>

      <nav aria-label="Member area" className="mt-8">
        <ul role="list" className="flex flex-wrap gap-2">
          {TABS.map((tab) => {
            const active = tab.href === current;
            return (
              <li key={tab.href}>
                <Link
                  href={tab.href}
                  aria-current={active ? "page" : undefined}
                  className={`flex min-h-11 items-center rounded-full border px-5 font-mono text-[11px] tracking-[0.08em] uppercase transition-colors ${
                    active
                      ? "border-accent bg-accent text-ink"
                      : "border-border text-text-2 hover:border-accent hover:text-accent-strong"
                  }`}
                >
                  {tab.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {children}
    </main>
  );
}
