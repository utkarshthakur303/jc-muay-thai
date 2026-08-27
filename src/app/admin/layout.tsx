import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Admin",
  /**
   * Nothing under /admin is public, including the sign-in page. `noindex`
   * keeps the panel out of search results; it is not a security control
   * and is not doing the work here — the guard on the (panel) group and
   * the RLS policies are.
   */
  robots: { index: false, follow: false },
};

/**
 * Metadata only. The guard lives one level down, on `(panel)/layout.tsx`.
 *
 * WHY THE SPLIT EXISTS. Every route under /admin used to be guarded from
 * this file, which was correct until /admin/login had to exist: a guard
 * here would redirect an unauthenticated visitor away from the very page
 * they came to sign in on, and a login page you cannot reach signed-out is
 * not a login page.
 *
 * A route group solves it without moving any URL. `(panel)` is invisible
 * in the path — /admin, /admin/classes and the rest resolve exactly where
 * they did — but it is a real layout boundary, so the nine panel pages
 * keep a shared guard while `login/` sits outside it as a sibling.
 *
 * The alternative was dropping the layout guard and trusting each page's
 * own `requireAdmin()`. All nine do call it, so nothing would have broken
 * today; it would have removed the property that adding a page cannot
 * accidentally add a hole, which is the only reason the layout guard was
 * worth having.
 */
export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
