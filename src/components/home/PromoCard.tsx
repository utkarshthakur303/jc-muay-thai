import Image from "next/image";

import type { SiteImage } from "@/lib/images/queries";

import { TiltCard } from "@/components/ui/TiltCard";
import { trialOffer } from "@/content/site";

/**
 * The newcomer offer.
 *
 * THIS TILE SAID "YOUR FIRST CLASS IS FREE" UNTIL 2026-08-18, AND THAT
 * WAS INVENTED. Nothing on the gym's own site has ever offered it. The
 * business's actual newcomer offer is a two-week trial, in their words
 * "perfect for newcomers… experience training without a long-term
 * commitment", and that is what this now says.
 *
 * The badge is gone with it. It read "Open Gym Fridays 4–6PM", derived
 * from a session in the timetable that also turned out to be invented —
 * the gym runs no open gym and is closed by 1:30 on a Friday. Deriving it
 * from the schedule was the right instinct and it worked exactly as
 * designed: when the fake session was deleted, the badge deleted itself.
 * It is removed here rather than left as a `?.` that can never be true.
 *
 * WHAT IS DELIBERATELY NOT HERE: a price. The old site does not state
 * what the trial costs, and the client's instruction was to say nothing
 * about it rather than guess at "free". This tile is the most persuasive
 * copy on the page and therefore the worst possible place to be wrong
 * about money.
 */
export function PromoCard({ image }: { image: SiteImage | null }) {
  return (
    <TiltCard className="card-photo card-hover copy-on-photo flex min-h-45 lg:col-start-2 lg:col-span-2 lg:row-start-2">
      {image ? (
        <Image
          src={image.src}
          alt=""
          fill
          // Not `priority`: this sits below the hero on every viewport, so
          // preloading it would compete with the LCP image for bandwidth.
          sizes="(max-width: 1023px) 100vw, 45vw"
          className="-z-10 object-cover opacity-55"
        />
      ) : null}
      <div aria-hidden className="scrim-promo absolute inset-0 -z-10" />

      <div className="flex w-full flex-col justify-center px-5 py-6 sm:px-8 lg:px-[clamp(20px,3vw,40px)]">
        {/* Only the 320px end actually broke — 312px of type in 246px of
            card — so the floor came down and the ceiling followed it. */}
        <p className="font-hero text-[clamp(1.125rem,2.4vw,1.5rem)] leading-tight text-text">
          {trialOffer.name.toUpperCase()}
        </p>
        <p className="mt-1 max-w-[46ch] text-[13px] leading-snug text-text-2">
          {trialOffer.blurb}
        </p>
      </div>
    </TiltCard>
  );
}
