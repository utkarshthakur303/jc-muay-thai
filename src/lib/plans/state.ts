import type { CommitmentSlug, PlanSlug } from "@/content/plans";

/**
 * The plan action's result.
 *
 * In its own module because `lib/plans/actions.ts` is a `"use server"`
 * file, and one of those may export nothing but async functions. Exporting
 * this type or the constant below from there takes down every server
 * action in the app at request time — and both `tsc` and `next build` pass
 * it. `lib/booking/state.ts` exists for exactly the same reason.
 */
export type PlanActionState = {
  readonly status: "idle" | "error";
  readonly message?: string;
};

export const initialPlanState: PlanActionState = { status: "idle" };

/**
 * What a member currently says they want.
 *
 * `available` is the migration's footprint. Migrations on this project are
 * applied by hand by the client, so this code is live before the table
 * exists — see the note in queries.ts for why that distinction is not
 * cosmetic.
 */
export type PlanState = {
  /** Could the table be read at all? False until the migration is applied. */
  readonly available: boolean;
  /** Has this member been through the plans page? */
  readonly asked: boolean;
  /** Which class they want. null means asked, and chose not to pick one. */
  readonly slug: PlanSlug | null;
  /**
   * How long they want to commit for — the axis that moves the price at
   * this gym. Independently nullable from `slug`: picking a class without
   * settling the term is the common case, since the term is what people
   * want to talk through at the desk.
   */
  readonly commitment: CommitmentSlug | null;
};
