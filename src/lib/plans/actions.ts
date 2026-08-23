"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { isCommitmentSlug, isPlanSlug } from "@/content/plans";
import { safeNextPath } from "@/lib/auth/redirects";
import { syncPlanBookings } from "@/lib/plans/autoBook";
import { planBookingTarget } from "@/lib/plans/planBookings";
import { getPlanState } from "@/lib/plans/queries";
// Type-only, and it has to stay that way: a "use server" module may export
// nothing but async functions. See lib/plans/state.ts.
import type { PlanActionState } from "@/lib/plans/state";
import { createClient, getUser } from "@/lib/supabase/server";

/**
 * Recording which plan a member says they are interested in.
 *
 * Runs as the signed-in member, not as the service role, so the policies
 * are the enforcement. What this file adds is the message: a policy can
 * refuse a write, it cannot explain that the table has not been created
 * yet.
 *
 * Unlike the read in queries.ts, this fails LOUDLY. A member who picks a
 * plan and is told nothing is a member who believes the gym knows
 * something it does not.
 */
export async function choosePlan(
  _prev: PlanActionState,
  formData: FormData,
): Promise<PlanActionState> {
  const user = await getUser();
  if (!user) {
    return { status: "error", message: "Please sign in to choose a plan." };
  }

  /**
   * An empty value is "I'll decide later", and it is stored rather than
   * ignored — a row with a null slug is what records that we asked and
   * they said not yet, which is the only thing that stops the booking flow
   * asking them again every single time.
   */
  const raw = formData.get("slug");
  const slug = isPlanSlug(raw) ? raw : null;

  // Anything that is neither a known slug nor the deliberate blank is a
  // malformed submission, not a decision. Storing null for it would record
  // an answer the member never gave.
  if (raw !== null && raw !== "" && slug === null) {
    return { status: "error", message: "That plan could not be identified." };
  }

  /**
   * How long they want to commit for. Optional by design — the radio
   * group has no preselected option, because a term that arrives because
   * nobody unticked it is not an answer, and at this gym the term is the
   * thing that changes the price.
   *
   * Unrecognised values fall to null rather than erroring. Unlike the
   * class, a missing term costs a member nothing: the gym asks at the
   * desk, which is where that conversation happens anyway.
   */
  const rawCommitment = formData.get("commitment");
  const commitment = isCommitmentSlug(rawCommitment) ? rawCommitment : null;

  const supabase = await createClient();

  const { error } = await supabase.from("member_plans").upsert(
    {
      user_id: user.id,
      plan_slug: slug,
      commitment,
      // Updated on every change, so the column reads as "as of" rather
      // than "first seen".
      chosen_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );

  if (error) {
    /**
     * THE MIGRATION FOR 'annual' HAS NOT BEEN APPLIED YET.
     *
     * 23514 is Postgres's check_violation, and the only CHECK a member can
     * trip on this table is `member_plans_commitment_known`. Until
     * 20260823140000_annual_commitment.sql is run, that constraint allows
     * three terms and the plans page offers four.
     *
     * Named separately because the generic "please try again" is a lie
     * here: trying again does the same thing for ever. Migrations on this
     * project are applied by hand by the client, so the code is live
     * before the constraint widens — there is no deploy ordering that
     * avoids the window, only a message that survives it.
     *
     * The member is told which control to move rather than what went
     * wrong internally, because the fix is entirely in their hands: the
     * other three terms all save.
     */
    if (error.code === "23514") {
      return {
        status: "error",
        message:
          "The yearly view isn't switched on yet. Choose Monthly and the " +
          "gym will talk the rest through with you.",
      };
    }

    return {
      status: "error",
      message:
        /**
         * The migration has not been applied yet.
         *
         * PGRST205 is PostgREST's own "not in the schema cache", and it is
         * what actually comes back — verified against the live database
         * rather than assumed. Postgres's own 42P01 ("relation does not
         * exist") is kept beside it because a future direct-SQL path would
         * raise that instead, and the two mean the same thing to a member.
         *
         * Named at all because the alternative is the client staring at
         * "something went wrong" on a feature that was simply never
         * switched on.
         */
        error.code === "PGRST205" || error.code === "42P01"
          ? "Plans aren't set up on this site yet. You can still book classes."
          : "Couldn't save that. Please try again.",
    };
  }

  /**
   * ── THE PLAN NOW BOOKS CLASSES ─────────────────────────────────────
   *
   * Asked for on 2026-08-23, and the client chose this over surfacing
   * the classes for one-tap booking with the cost stated in front of
   * them: these are real bookings against a real capacity of sixteen,
   * and the member's name goes on the roster the coach reads at the
   * door.
   *
   * AFTER the plan is saved, deliberately. The answer to "which class
   * are you interested in" is the thing the gym actually asked for; the
   * bookings are a consequence of it. If this half fails, the answer is
   * still recorded and the member is told what did and did not happen.
   *
   * It cannot throw — every path inside returns counts — so it does not
   * need a try/catch, and must not have one that could swallow the
   * redirect below.
   */
  const outcome = await syncPlanBookings(planBookingTarget(slug, commitment));

  revalidatePath("/account");
  revalidatePath("/book");

  /**
   * `redirect` throws internally, so it must sit outside any try/catch —
   * a catch here would swallow the redirect and return a success state
   * that goes nowhere. It is also the last statement for that reason.
   *
   * The destination is guarded: without safeNextPath, `?next=https://…`
   * would turn this into an open redirect that borrows the site's
   * credibility to land a member on a lookalike page. A hostile value
   * collapses to "/" rather than being followed.
   *
   * ── THE FALLBACK IS NOW THE HOME PAGE, NOT /book ───────────────────
   *
   * The client's instruction on 2026-08-23, and the feature above is
   * what makes it coherent rather than obstructive. It used to be /book
   * because this screen stood between a member and booking; now
   * choosing a plan *is* booking, so sending them to the calendar to do
   * it again would be asking twice. An explicit `next` — the "Change"
   * link on /account, the trial panel's route to /book — still wins.
   */
  const requested = formData.get("next");
  const destination =
    typeof requested === "string" && requested.length > 0
      ? safeNextPath(requested)
      : "/";

  redirect(withOutcome(destination, slug, commitment, outcome));
}

/**
 * Booking the week ahead again, for a plan that was chosen a while back.
 *
 * ── WHY THIS BUTTON HAS TO EXIST ───────────────────────────────────
 *
 * A plan books seven days. Seven days later those classes have happened,
 * and without a way to ask for more, "your plan books your classes"
 * quietly becomes something it did once, in the past — while the account
 * page carries on saying it in the present tense.
 *
 * ── AND WHY IT IS A BUTTON RATHER THAN AUTOMATIC ───────────────────
 *
 * The obvious alternative is to top the week up whenever a member opens
 * /account. That would be a page render that consumes capacity, and a
 * render runs on a prefetch, on a refresh, on a React double-render, and
 * on a link the member merely hovered. Nobody would have pressed
 * anything. Booking is not idempotent the way generating timetable rows
 * is, and the difference is a stranger's name on the gym's roster.
 *
 * So the same rule as everywhere else here: bookings happen because
 * somebody asked for them.
 *
 * It reads the plan from the database rather than taking it from the
 * form. There is no decision to submit — the answer is already stored,
 * and accepting one here would be a second way to change a plan, on a
 * button that does not say so.
 */
export async function refreshPlanBookings(): Promise<void> {
  const user = await getUser();
  if (!user) redirect("/login?next=%2Faccount");

  const state = await getPlanState();
  const outcome = await syncPlanBookings(
    planBookingTarget(state.slug, state.commitment),
  );

  revalidatePath("/account");
  revalidatePath("/book");

  // Straight back to /account, carrying the counts — so the same banner
  // that reports a plan choice reports this, and there is one place where
  // "what just happened to my classes" is written down.
  redirect(withOutcome("/account", state.slug, state.commitment, outcome));
}

/**
 * The confirmation, carried in the URL.
 *
 * A member who chooses Intermediate and silently finds six classes in
 * their account has been done something to. They have to be told, on the
 * page they land on — and the page they land on is usually the home page,
 * which is statically prerendered and must stay that way.
 *
 * So it travels as a query string and is read after mount by a client
 * component, exactly as the member chip reads the display cookie. Nothing
 * on the server reads it, so `/` keeps its prerender. If the build output
 * ever shows `/` as dynamic, something started reading this during render.
 *
 * IT IS A CONFIRMATION, NOT A RECORD. Anyone can type `?booked=99` into
 * their own address bar and read a sentence that is not true about their
 * own browser, which is why the banner clamps what it will repeat and
 * links straight to the real list on /account. The same reasoning as the
 * display cookie: it shows, it does not authorise, and the truth is one
 * click away.
 */
function withOutcome(
  destination: string,
  slug: string | null,
  commitment: string | null,
  outcome: { available: boolean; booked: number; released: number },
): string {
  const params = new URLSearchParams();
  params.set("plan", slug ?? "none");
  if (commitment) params.set("term", commitment);

  /**
   * Counts only when the feature is actually on. Before the migration
   * lands `available` is false and nothing was booked — omitting them is
   * what stops the banner claiming a week of classes that do not exist.
   */
  if (outcome.available) {
    params.set("booked", String(outcome.booked));
    if (outcome.released > 0) params.set("released", String(outcome.released));
  }

  // safeNextPath permits a path that already carries a query string, so
  // the separator is decided rather than assumed.
  const separator = destination.includes("?") ? "&" : "?";
  return `${destination}${separator}${params.toString()}`;
}
