import "server-only";

import { isPlanSlug } from "@/content/plans";
import type { MemberQuote } from "@/lib/admin/quote";
import { createClient } from "@/lib/supabase/server";

/**
 * Reading what a member has been quoted.
 *
 * A note the gym keeps for itself. No member can read this — the policies
 * on `member_quotes` are admin-only on every verb, including select, which
 * makes it the first table in this schema a member cannot see even their
 * own row in. Deliberate: the site has never shown a price, the gym
 * settles money in person, and a figure fetched from PostgREST would be
 * one nobody was ever told was final.
 *
 * The arithmetic lives in `quote.ts`, which the form shares. This file
 * only fetches.
 */

function asNumber(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

export async function getQuote(userId: string): Promise<MemberQuote | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("member_quotes")
    .select(
      "plan_slug,price_cents,discount_kind,discount_value,final_cents,note,updated_at",
    )
    .eq("user_id", userId)
    .maybeSingle();

  if (error || !data) return null;
  // An unrecognised slug means the plan list moved on without this row.
  // Treated as "no quote" rather than rendered against a plan that no
  // longer exists.
  if (!isPlanSlug(data.plan_slug)) return null;

  return {
    planSlug: data.plan_slug,
    priceCents: asNumber(data.price_cents),
    discountKind: data.discount_kind === "amount" ? "amount" : "percent",
    discountValue: asNumber(data.discount_value),
    // Read back from the generated column, never recomputed here. The
    // database is the authority on the total.
    finalCents: asNumber(data.final_cents),
    note: typeof data.note === "string" && data.note.trim() !== "" ? data.note : null,
    updatedAt: typeof data.updated_at === "string" ? data.updated_at : "",
  };
}
