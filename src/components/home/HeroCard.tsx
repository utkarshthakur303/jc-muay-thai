import Image from "next/image";
import Link from "next/link";

import { PrimaryCta } from "@/components/layout/PrimaryCta";
import { TiltCard } from "@/components/ui/TiltCard";
import { site } from "@/content/site";

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
export function HeroCard() {
  return (
    <TiltCard className="card-photo card-hover @container flex min-h-[70svh] shadow-hero lg:col-start-1 lg:row-span-3 lg:min-h-0">
      <Image
        src="/images/hero.jpeg"
        alt=""
        fill
        priority
        // Below lg the card is the full content column; above it, roughly
        // a third of a 1440px shell. Getting this wrong is what makes a
        // browser download a 1600px image to paint it 480px wide.
        sizes="(max-width: 1023px) 100vw, 35vw"
        className="-z-10 object-cover"
      />
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
        <h1 className="mt-3.5 font-display text-[clamp(3.25rem,16cqw,5.5rem)] leading-[0.9] tracking-[0.02em] text-on-photo">
          {site.name.toUpperCase()}
        </h1>

        <p className="mt-2.5 font-display text-lg tracking-[0.1em] text-accent">
          {site.tagline.toUpperCase()}
        </p>

        <p className="mt-3.5 max-w-[420px] text-sm leading-relaxed text-on-photo-2">
          Train authentic Muay Thai. Build confidence, improve fitness, learn
          real skills. No gear and no experience needed — your first class is
          free.
        </p>

        <div className="mt-6 flex flex-wrap gap-3">
          <PrimaryCta label="Book your free class" />
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
