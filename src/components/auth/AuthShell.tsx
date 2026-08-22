import Image from "next/image";
import Link from "next/link";

import { LogoMark } from "@/components/ui/Icon";
import { getSiteImages } from "@/lib/images/queries";

type AuthShellProps = {
  /** Small mono eyebrow above the heading, e.g. "Members". */
  eyebrow: string;
  heading: string;
  subheading: string;
  children: React.ReactNode;
  /** Rendered under the card — the sign-up / sign-in cross-link. */
  footer?: React.ReactNode;
};

/**
 * Split layout shared by every auth screen: photographic panel on the left,
 * form on the right.
 *
 * Below 1024px the photo panel is dropped entirely — not scaled down — and a
 * compact brand lockup takes its place, so the form starts at the top of the
 * viewport on a phone rather than below a decorative image.
 *
 * Column ratio and padding both step up at xl. At lg with the wider ratio the
 * form column computed narrower than the single-column layout it replaces,
 * which made the form visibly shrink as the window grew past 1024px.
 *
 * ── IT FETCHES ITS OWN PHOTOGRAPH, AND THAT IS DELIBERATE ───────────
 * The hero moved into the database on 2026-08-23 so the gym can replace
 * it. This screen shows the same picture as the home page, and it has to
 * keep doing so — a replaced hero that changed on `/` but not on
 * `/login` is a half-applied edit the owner has no way to explain.
 *
 * Fetching here rather than threading a prop through all three auth
 * pages costs nothing: the response is cached under the `site-images`
 * tag, so the three routes share one request, and a plain fetch does not
 * touch `cookies()` — these pages stay prerendered exactly as they were.
 * ────────────────────────────────────────────────────────────────────
 */
export async function AuthShell({
  eyebrow,
  heading,
  subheading,
  children,
  footer,
}: AuthShellProps) {
  const { slots } = await getSiteImages();
  const hero = slots.hero;

  return (
    <main className="min-h-dvh lg:grid lg:grid-cols-[1fr_1fr] xl:grid-cols-[1.1fr_1fr]">
      {/* Photographic panel */}
      <div className="relative isolate hidden overflow-hidden lg:block">
        {hero ? (
          <Image
            src={hero.src}
            alt=""
            fill
            priority
            sizes="(max-width: 1024px) 0px, 55vw"
            className="object-cover"
          />
        ) : null}
        {/* Fixed dark scrim in both themes: this is a photo, not a themed
            surface, and light-theme text was unreadable over bright patches. */}
        <div aria-hidden className="scrim-photo absolute inset-0" />
        <div className="relative z-10 flex h-full flex-col justify-between p-12">
          <Link
            href="/"
            className="inline-flex w-fit items-center gap-3 rounded-full focus-visible:outline-2"
          >
            <span className="flex size-11 items-center justify-center rounded-full bg-accent text-ink">
              <LogoMark />
            </span>
            <span className="font-display text-2xl tracking-wide text-on-photo">
              JC MUAY THAI
            </span>
          </Link>

          <div>
            <p className="font-mono text-xs uppercase tracking-[0.16em] text-accent">
              Muay Thai — Jersey City
            </p>
            <p className="mt-4 max-w-md font-display text-5xl leading-[0.92] tracking-wide text-on-photo">
              UNLEASH YOUR INNER FIGHTER
            </p>
            <p className="mt-4 max-w-sm text-sm leading-relaxed text-on-photo-2">
              Build confidence. Improve fitness. Learn real skills. Start with
              a two-week trial — no gear, no experience needed.
            </p>
          </div>
        </div>
      </div>

      {/*
        Form panel. Below lg the same hero photograph sits behind it as a
        full-bleed background; at lg and above it moves to its own column
        and this panel reverts to a plain themed surface.
      */}
      <div className="auth-on-photo relative flex min-h-dvh flex-col justify-center px-5 py-10 sm:px-10 lg:min-h-0 lg:px-10 xl:px-14">
        {/*
          sizes resolves to 0px at lg and above, so desktop browsers pick the
          smallest srcset candidate for this hidden copy instead of fetching
          the full-width image twice.
        */}
        {hero ? (
          <Image
            src={hero.src}
            alt=""
            fill
            priority
            sizes="(max-width: 1023px) 100vw, 0px"
            className="object-cover lg:hidden"
          />
        ) : null}
        {/* Scrim carrying the text contrast. Strongest at top and bottom,
            where the brand lockup and the terms copy sit. */}
        <div
          aria-hidden
          className="scrim-photo-strong absolute inset-0 lg:hidden"
        />

        <div className="relative z-10 mx-auto w-full max-w-md">
          {/* Compact brand lockup, shown only when the photo panel is hidden */}
          <Link
            href="/"
            className="mb-10 inline-flex items-center gap-3 lg:hidden"
          >
            <span className="flex size-10 items-center justify-center rounded-full bg-accent text-ink">
              <LogoMark size={20} />
            </span>
            <span className="font-display text-xl tracking-wide text-text">
              JC MUAY THAI
            </span>
          </Link>

          <p className="font-mono text-[11px] uppercase tracking-[0.1em] text-text-2">
            {eyebrow}
          </p>
          <h1 className="mt-2 font-display text-4xl tracking-wide text-text sm:text-5xl">
            {heading}
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-text-2">
            {subheading}
          </p>

          <div className="mt-8">{children}</div>

          {footer ? (
            <div className="mt-8 text-sm text-text-2">{footer}</div>
          ) : null}
        </div>
      </div>
    </main>
  );
}
