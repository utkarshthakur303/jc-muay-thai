import { ClassCard } from "@/components/classes/ClassCard";
import { PrimaryCta } from "@/components/layout/PrimaryCta";
import { Section } from "@/components/layout/Section";
import { getClassLevels } from "@/content/classes";
import type { Plan } from "@/content/plans";
import { pricedPlanBySlug } from "@/lib/plans/priceRows";
import { totalWeeklySessions } from "@/content/schedule";
import type { SiteImages } from "@/lib/images/queries";
import type { TimetableEntry } from "@/lib/schedule/queries";
import { trialOffer } from "@/content/site";

/**
 * The four classes, in progression order with Kids last.
 *
 * The mockup put a BEGINNER / INTERMEDIATE / ADVANCED tab strip above this
 * grid. The tabs set state that nothing read — every card rendered
 * regardless of which was selected. They are not reimplemented, and not
 * because they were broken: even working, a filter that hides three of
 * four visible items is a control that only ever removes information. The
 * numbering already carries the progression the tabs were gesturing at.
 *
 * Kids joined the grid on 2026-08-18. The class has always been in the
 * timetable and was simply missing from this section, so a parent reading
 * the page had no way to learn it existed.
 *
 * One call to action at the end rather than one per card. Four identical
 * buttons pointing at the same destination would add three tab stops and
 * no choice — the cards are here to inform, and the decision comes after
 * reading them.
 */
export function ClassesSection({
  timetable,
  images,
  plans,
}: {
  timetable: readonly TimetableEntry[];
  images: SiteImages;
  /**
   * The plans carrying the prices in force, fetched once by the page.
   * A class and a plan are the same vocabulary — `PlanSlug` is `LevelId`
   * — so the lookup below cannot go stale silently.
   */
  plans: readonly Plan[];
}) {
  const levels = getClassLevels(timetable, images.slots);

  return (
    <Section
      id="classes"
      title="CLASSES"
      meta={`${totalWeeklySessions(timetable)} sessions a week · all levels welcome`}
      intro="Every class is coached start to finish. Start where you are — most people walk in with no combat sports background at all — and move up when your coach says you are ready."
    >
      {/*
        Two-up in the middle range rather than jumping straight from one
        to four. At 1024px a four-column grid gives each card about 200px
        of interior, which "ADVANCED & FIGHTER" in Anton does not fit
        inside.
      */}
      <ul
        role="list"
        className="mt-7 grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4 lg:gap-6"
      >
        {levels.map((level) => (
          <ClassCard
            key={level.id}
            level={level}
            plan={pricedPlanBySlug(plans, level.id) ?? null}
          />
        ))}
      </ul>

      <div className="mt-8 flex flex-wrap items-center gap-4">
        <PrimaryCta label={trialOffer.cta} />
        <p className="text-sm text-text-2">
          Not sure which level? Book the beginner class — we&rsquo;ll place you
          after your first session.
        </p>
      </div>
    </Section>
  );
}
