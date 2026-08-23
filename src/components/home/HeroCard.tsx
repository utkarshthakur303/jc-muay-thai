import Image from "next/image";

import type { SiteImage } from "@/lib/images/queries";
import Link from "next/link";

import { PrimaryCta } from "@/components/layout/PrimaryCta";
import { TiltCard } from "@/components/ui/TiltCard";
import { site, trialOffer } from "@/content/site";

/**
 * The largest tile in the bento, and the page's LCP element.
 *
 * Three decisions worth stating:
 *
 * 1. next/image rather than a CSS background. The mockup used
 *    `background: url(...) center/cover`, which cannot be preloaded, has
 *    no srcset, and hands every phone the desktop-sized JPEG. As an <img>
 *    with `priority`, this is preloaded at high fetch priority and served
 *    as AVIF at the size the viewport actually needs — the difference
 *    between a good and a poor LCP on a phone.
 *
 * 2. Copy anchored to the bottom, not centred. The scrim is strongest
 *    there, which is what lets the accent eyebrow clear WCAG AA over an
 *    arbitrary photograph without the text-shadow stack the mockup used.
 *    See --scrim-hero in globals.css for the measurements.
 *
 * 3. Two labelled buttons in place of the mockup's three. The mockup's
 *    were identical unlabelled circles carrying the same icon and the same
 *    href — three tab stops that announce nothing to a screen reader and
 *    mean nothing to anyone else. The hero is the most valuable space on
 *    the site; it gets the real primary action and one real alternative.
 */
export function HeroCard({ image }: { image: SiteImage | null }) {
  return (
    <TiltCard className="card-photo card-hover @container flex min-h-[70svh] shadow-hero lg:col-start-1 lg:row-span-3 lg:min-h-0">
      {/*
        Null only if somebody empties this slot in the database, which the
        panel does not offer — reverting it restores the built-in
        photograph rather than removing one. Handled anyway: the card
        keeps its scrim, its copy and its buttons and simply has no
        picture behind them, which is a degraded hero rather than a
        crashed page.

        `alt=""` is deliberate and is why this slot does not ask for a
        description. The copy on top already says the gym's name and its
        city; announcing the photograph as well would make a screen
        reader read the same thing twice.
      */}
      {image ? (
        <Image
          src={image.src}
          alt=""
          fill
          priority
          // Below lg the card is the full content column; above it, roughly
          // a third of a 1440px shell. Getting this wrong is what makes a
          // browser download a 1600px image to paint it 480px wide.
          sizes="(max-width: 1023px) 100vw, 35vw"
          className="-z-10 object-cover"
        />
      ) : null}
      <div aria-hidden className="scrim-hero absolute inset-0 -z-10" />

      <div className="flex w-full flex-col justify-end p-6 sm:p-8 lg:p-[clamp(20px,3vw,40px)]">
        <p className="font-mono text-xs tracking-[0.16em] text-accent uppercase">
          Muay Thai — {site.city}
        </p>

        {/*
          Sized in cqw — a share of THIS CARD's width, not the viewport's.

          The mockup used 7.2vw, which is only safe while the card keeps a
          fixed relationship to the window. It does not: the card is 1.3
          of 3.3 columns beside a 136px rail inside a shell that stops
          growing at 1440px, so at 1024px the viewport-derived size
          resolves to 74px inside a 310px-wide card and the wordmark
          breaks. A container query removes the coupling entirely — the
          type cannot outgrow the box it is in, at any width, including
          ones no one has tested.
        */}
        {/*
          Retuned for Michroma, not merely re-familied.

          Measured in a browser: at the same point size Michroma sets
          "JC MUAY THAI" 2.01× as wide as Anton, and the whole hero grid
          ran 74px off the side of a 320px phone when the family was
          swapped and nothing else. An extended square face cannot wear a
          condensed face's metrics.

          16cqw became 11cqw — not the full half, because the wordmark
          breaks to two lines and the constraint is "JC MUAY", not the
          whole string. The clamp floor and ceiling came down with it.

          12cqw was the first answer and it broke to THREE lines at
          exactly 1024px — the card is at its narrowest against its own
          padding right at the lg breakpoint, and the wordmark split
          JC / MUAY / THAI there and nowhere else. Swept every width from
          320 to 1920 to find it; 11cqw holds two lines throughout.

          The tracking reversed sign. Anton is tight enough to need
          0.02em opening it up; Michroma is drawn with generous
          sidebearings already, and adding to them pushed the second line
          out on its own. At -0.02em the wordmark holds together as one
          object — the face ships no kern pair for A→Y, so at 45px
          "MUAY" read as "MUA Y" with the default spacing.

          leading 0.9 → 1.02 for the same reason in the other direction:
          0.9 is safe under Anton's very large caps and collides under
          Michroma's taller ascenders.
        */}
        <h1 className="mt-3.5 font-hero text-[clamp(1.9rem,11cqw,3.5rem)] leading-[1.02] tracking-[-0.02em] text-on-photo">
          {site.name.toUpperCase()}
        </h1>

        {/*
          18px + 0.1em set this on two lines at every width, under a
          wordmark that is itself two lines. 14px with the tracking
          removed puts it back on one line from 390px up. */}
        <p className="mt-3 font-hero text-sm leading-snug text-accent">
          {site.tagline.toUpperCase()}
        </p>

        <p className="mt-3.5 max-w-[420px] text-sm leading-relaxed text-on-photo-2">
          Train authentic Muay Thai. Build confidence, improve fitness, learn
          real skills. No gear and no experience needed — start with a
          two-week trial.
        </p>

        <div className="mt-6 flex flex-wrap gap-3">
          <PrimaryCta label={trialOffer.cta} />
          <Link
            href="#classes"
            className="flex min-h-11 items-center justify-center rounded-full border border-on-photo-3 px-6 font-mono text-[12px] font-semibold tracking-[0.08em] text-on-photo uppercase backdrop-blur-sm transition-colors hover:border-accent hover:text-accent"
          >
            See classes
          </Link>
        </div>
      </div>
    </TiltCard>
  );
}
