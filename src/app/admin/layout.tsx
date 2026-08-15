import type { Metadata } from "next";

import { requireAdmin } from "@/lib/admin/guard";

export const metadata: Metadata = {
  title: "Admin",
  /**
   * Nothing under /admin is public. `noindex` keeps it out of search
   * results; it is not a security control and is not doing the work here —
   * the guard below and the RLS policies are.
   */
  robots: { index: false, follow: false },
};

/**
 * Guards every route under /admin.
 *
 * The check is repeated in each page as well, and that is not redundancy
 * for its own sake: a layout is not re-executed on every client-side
 * navigation between its own children, so a layout-only guard is a guard
 * with a gap in it. Cheap to repeat — one indexed lookup on a table with
 * one row — and it means adding a page cannot accidentally add a hole.
 *
 * Neither check is the enforcement. Every table the panel reads is gated
 * by an RLS policy calling `is_admin()`; these two decide what renders.
 */
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireAdmin();
  return children;
}
