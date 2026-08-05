import { ClassCard } from "@/components/classes/ClassCard";
import { PrimaryCta } from "@/components/layout/PrimaryCta";
import { Section } from "@/components/layout/Section";
import { getClassLevels } from "@/content/classes";
import { totalWeeklySessions } from "@/content/schedule";

/**
 * The three levels, in progression order.
 *
 * The mockup put a BEGINNER / INTERMEDIATE / ADVANCED tab strip above this
 * grid. The tabs set state that nothing read — all three cards rendered
 * regardless of which was selected. They are not reimplemented, and not
 * because they were broken: even working, a filter that hides two of three
 * visible items is a control that only ever removes information. The
 * numbering already carries the progression the tabs were gesturing at.
 *
 * One call to action at the end rather than one per card. Three identical
 * buttons pointing at the same destination would add two tab stops and no
 * choice — the cards are here to inform, and the decision comes after
 * reading them.
 */
export function ClassesSection() {
  const levels = getClassLevels();

  return (
    <Section
      id="classes"
      title="CLASSES"
      meta={`${totalWeeklySessions} sessions a week · all levels welcome`}
      intro="Every class is coached start to finish. Start where you are — most people walk in with no combat sports background at all — and move up when your coach says you are ready."
    >
      <ul
        role="list"
        className="mt-7 grid grid-cols-1 gap-5 lg:grid-cols-3 lg:gap-6"
      >
        {levels.map((level) => (
          <ClassCard key={level.id} level={level} />
        ))}
      </ul>

      <div className="mt-8 flex flex-wrap items-center gap-4">
        <PrimaryCta label="Book your free class" />
        <p className="text-sm text-text-2">
          Not sure which level? Book the beginner class — we&rsquo;ll place you
          after your first session.
        </p>
      </div>
    </Section>
  );
}
