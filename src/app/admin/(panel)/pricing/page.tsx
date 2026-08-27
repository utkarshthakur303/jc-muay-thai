import { AdminShell } from "@/components/admin/AdminShell";
import { PriceForm } from "@/components/admin/PriceForm";
import { site } from "@/content/site";
import { requireAdmin } from "@/lib/admin/guard";
import { getPlanReach } from "@/lib/admin/pricing";
import { getPlanPrices, pricedPlans } from "@/lib/plans/prices";

/**
 * What the gym advertises.
 *
 * FOUR NUMBERS AND A HALF — a monthly rate per plan, and a contract rate
 * where there is one. Everything else about a plan is copy, lives in
 * `src/content/plans.ts` and changes with a deploy, because it is read
 * alongside sentences elsewhere on the page that would have to change
 * with it.
 *
 * The page is deliberate about the one thing a person could be wrong
 * about here, and states it twice: changing a price does not re-quote
 * anybody. See `member_quotes` — a quote snapshots its own figure when
 * it is agreed, and nothing on this screen reaches it.
 */

export const metadata = { title: "Pricing" };

/** "23 August 2026". The year is there because a price is argued about months later. */
function changedLabel(iso: string | null): string | null {
  if (iso === null) return null;
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return null;
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: site.timeZone,
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(at);
}

export default async function AdminPricingPage() {
  await requireAdmin();

  const [prices, reach] = await Promise.all([getPlanPrices(), getPlanReach()]);
  const editable = prices.source === "database";
  const priced = pricedPlans(prices);

  return (
    <AdminShell
      current="/admin/pricing"
      heading="Pricing"
      lead="The rates the gym advertises. Saving one puts it on the website straight away."
    >
      {/*
        No editing at all on the fallback path. The figures below are the
        ones compiled into the build; there is no row to update, so a
        Save button over one could not do what it says. The fields stay
        visible and read-only — the owner still needs to see what the
        site is showing today.
      */}
      {editable ? null : (
        <div className="mt-5 rounded-card border border-danger px-5 py-4">
          <p className="max-w-prose text-sm leading-relaxed text-text">
            <strong className="font-semibold">
              Editable pricing is not switched on yet.
            </strong>{" "}
            The <code className="font-mono text-[13px]">plan_prices</code> table
            has not been created, so the figures below are the ones built into
            the site rather than anything you can change here. Run the migration{" "}
            <code className="font-mono text-[13px]">
              20260823180000_plan_prices.sql
            </code>{" "}
            and this page starts working. Members see exactly the same prices in
            the meantime.
          </p>
        </div>
      )}

      {/*
        The reassurance, before the forms rather than after them. Anyone
        about to raise a price wants to know what it does to the people
        already paying one, and finding that out underneath four inputs
        is finding it out too late.
      */}
      <div className="mt-8 rounded-card border border-border px-5 py-4">
        <p className="max-w-prose text-sm leading-relaxed text-text-2">
          <strong className="font-semibold text-text">
            Changing a price here does not change anyone&rsquo;s quote.
          </strong>{" "}
          A quote is recorded against a member when you agree it, and it keeps
          the figure you agreed. These are the advertised rates — what a
          stranger reads on the website before they walk in.
        </p>
        <p className="mt-3 max-w-prose text-sm leading-relaxed text-text-2">
          They appear on the home page, on the plans page and on the account
          page of any member who has chosen that plan. Nothing on this website
          takes payment; the gym still handles money in person.
        </p>
      </div>

      <ul role="list" className="mt-8 grid gap-5 lg:grid-cols-2">
        {priced.map((plan) => (
          <PriceForm
            key={plan.slug}
            plan={plan}
            savedPriceCents={plan.priceCents}
            savedContractCents={plan.contractPriceCents}
            changedLabel={changedLabel(prices.prices[plan.slug].updatedAt)}
            reach={reach[plan.slug]}
            editable={editable}
          />
        ))}
      </ul>

      <p className="mt-8 max-w-prose text-sm leading-relaxed text-text-3">
        A plan&rsquo;s name, its description and what it includes are part of the
        website&rsquo;s copy and change with a release, not from here. The yearly
        figure on the plans page is always twelve monthly ones — the gym does
        not sell a year, and nothing here can make it look like it does.
      </p>
    </AdminShell>
  );
}
