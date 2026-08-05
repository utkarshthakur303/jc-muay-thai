import Image from "next/image";

import { TiltCard } from "@/components/ui/TiltCard";
import { sessionsOnDay } from "@/content/schedule";
import { formatRange } from "@/lib/format/time";

/**
 * The free-class offer, with the open-gym window as a badge.
 *
 * The badge text is derived from the timetable rather than typed. The
 * mockup hardcoded "Open Gym Fridays 4–6PM" next to a schedule table that
 * separately listed the same session — two copies of one fact, and no way
 * for the code to notice when they stopped agreeing.
 */
export function PromoCard() {
  const openGym = sessionsOnDay("fri").find(
    (session) => session.level === "open-gym",
  );

  return (
    <TiltCard className="card-photo card-hover copy-on-photo flex min-h-45 lg:col-start-2 lg:col-span-2 lg:row-start-2">
      <Image
        src="/images/promo.jpeg"
        alt=""
        fill
        // Not `priority`: this sits below the hero on every viewport, so
        // preloading it would compete with the LCP image for bandwidth.
        sizes="(max-width: 1023px) 100vw, 45vw"
        className="-z-10 object-cover opacity-55"
      />
      <div aria-hidden className="scrim-promo absolute inset-0 -z-10" />

      <div className="flex w-full flex-col justify-center px-5 py-6 sm:px-8 lg:px-[clamp(20px,3vw,40px)]">
        <p className="font-display text-[clamp(1.5rem,2.4vw,2rem)] tracking-[0.01em] text-text">
          Your First Class Is Free
        </p>
        <p className="mt-1 text-[13px] text-text-2">
          No gear, no experience needed — just show up.
        </p>
      </div>

      {openGym ? (
        <p className="absolute top-3.5 right-4 rounded-[14px] border border-border bg-card px-3.5 py-1.5 font-mono text-[11px] text-accent-strong">
          Open Gym Fridays {formatRange(openGym.start, openGym.end)}
        </p>
      ) : null}
    </TiltCard>
  );
}
