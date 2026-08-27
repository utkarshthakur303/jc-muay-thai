import { requireAdmin } from "@/lib/admin/guard";

/**
 * Guards every route in the panel group.
 *
 * The check is repeated in each page as well, and that is not redundancy
 * for its own sake: a layout is not re-executed on every client-side
 * navigation between its own children, so a layout-only guard is a guard
 * with a gap in it. Cheap to repeat — one indexed lookup on a table with
 * one row — and it means adding a page cannot accidentally add a hole.
 *
 * Neither check is the enforcement. Every table the panel reads is gated
 * by an RLS policy calling `is_admin()`; these two decide what renders.
 *
 * /admin/login is deliberately NOT in this group. See admin/layout.tsx.
 */
export default async function AdminPanelLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireAdmin();
  return children;
}
