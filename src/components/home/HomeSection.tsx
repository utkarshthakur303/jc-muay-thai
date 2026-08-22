import { ClassLoadChart } from "@/components/home/ClassLoadChart";
import { HeroCard } from "@/components/home/HeroCard";
import { LiveClassStatus } from "@/components/home/LiveClassStatus";
import { PromoCard } from "@/components/home/PromoCard";
import { StatCard } from "@/components/home/StatCard";
import { site } from "@/content/site";
import type { SiteImages } from "@/lib/images/queries";
import type { TimetableEntry } from "@/lib/schedule/queries";

/**
 * The bento grid.
 *
 * Layout: a 1.3/1/1 three-column, three-row grid above lg, collapsing to a
 * single column below it — the tiles stack in reading order rather than
 * shrinking, because a 1.3fr hero at 500px wide is unreadable.
 *
 * The mockup faded and slid every tile in on scroll, starting each at
 * `opacity: 0`. Two problems, both fatal above the fold:
 *
 *   - this grid *is* the first viewport, so the observer fires
 *     immediately and the "reveal" is just a delay before the page
 *     appears;
 *   - content that starts invisible and needs JavaScript to become
 *     visible is content that is gone if the bundle is slow, blocked, or
 *     errors — and it is the LCP element.
 *
 * So the tiles render at full opacity, in the HTML. The only motion left
 * is inside the chart, where growth carries meaning, and it is pure CSS.
 */
export function HomeSection({
  timetable,
  images,
}: {
  timetable: readonly TimetableEntry[];
  images: SiteImages;
}) {
  return (
    <section id="home" aria-label="Introduction">
      <div className="grid grid-cols-1 gap-4 perspective-[1600px] lg:h-[calc(100dvh-152px)] lg:min-h-140 lg:grid-cols-[1.3fr_1fr_1fr] lg:grid-rows-[repeat(3,minmax(150px,1fr))] lg:gap-4.5">
        <HeroCard image={images.slots.hero} />

        <StatCard
          label={`In ${site.city}`}
          value={`${site.yearsEstablished} YEARS`}
          className="lg:col-start-2"
        />

        <StatCard
          label="Morning and evening, most weekdays"
          value="2× DAILY"
          className="lg:col-start-3"
        >
          <LiveClassStatus timetable={timetable} />
        </StatCard>

        <PromoCard image={images.slots.promo} />
        <ClassLoadChart timetable={timetable} />
      </div>
    </section>
  );
}
