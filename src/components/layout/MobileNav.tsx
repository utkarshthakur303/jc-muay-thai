"use client";

import Link from "next/link";

import { useActiveSection } from "@/components/layout/ActiveSection";
import { Icon } from "@/components/ui/Icon";
import { navSections } from "@/content/site";

/**
 * The rail's phone counterpart: same accent surface, same ink content, same
 * active treatment, pinned to the thumb zone.
 *
 * Six items share one bar, which is what dictates the layout. The budget
 * on a 360px Android — the narrowest phone still worth designing for — is
 * 360 − 32 (inset) − 16 (padding) = 312px. Booking takes a fixed 48px and
 * the five sections divide the rest, which lands each of them around 48px
 * wide. That is why the labels come from `navSections.short` ("Times", not
 * "Schedule"): the full words do not fit, and a truncated "Schedu…" is
 * worse than a shorter true word.
 *
 * Booking is deliberately `w-12 shrink-0` rather than `flex-1`. As a
 * flex-1 sibling of the <ul> it was claiming half the bar to itself —
 * the five sections shared the other half at 31px each and every label
 * longer than five characters was truncated on every phone. A fixed
 * width is also simply correct: "Book" is four characters and does not
 * need to grow when the viewport does.
 *
 * The label size is fluid rather than fixed at 10px. "Classes" needs
 * 43px at 10px and only ~40px exists on a 320px screen, so the clamp
 * lets it ease down to 9px there and sit at the intended 10px everywhere
 * else. `truncate` stays as the last resort, not the working state.
 *
 * At roughly 48×44 each target clears WCAG 2.5.8 (24×24) comfortably and
 * misses the AAA 44×44 by a few pixels horizontally — the honest trade
 * for keeping words under the icons, which matters more to a first-time
 * visitor than four pixels of thumb margin.
 *
 * Booking sits outside the <ul> because it is not a section of this page,
 * and it is outlined rather than filled so it cannot be mistaken for the
 * active-tab treatment.
 *
 * `pb-32` on <main> reserves the space this occupies; without it the bar
 * would cover the last of the page content, which no amount of scrolling
 * could reveal.
 */
export function MobileNav() {
  const active = useActiveSection();

  return (
    <nav
      aria-label="Sections"
      className="fixed inset-x-4 bottom-4 z-40 flex items-stretch gap-1 rounded-4xl bg-accent px-2 py-2 shadow-float lg:hidden"
    >
      <ul role="list" className="flex flex-1 items-stretch gap-1">
        {navSections.map((section) => {
          const isActive = active === section.id;
          return (
            <li key={section.id} className="min-w-0 flex-1">
              <Link
                href={`#${section.id}`}
                aria-current={isActive ? "location" : undefined}
                className={`flex min-h-11 flex-col items-center justify-center gap-1 rounded-3xl py-1.5 transition-colors ${
                  isActive ? "bg-ink text-accent" : "text-ink/85"
                }`}
              >
                <Icon name={section.icon} size={20} />
                <span className="w-full truncate text-center font-mono text-[clamp(9px,2.6vw,10px)] leading-none tracking-[0.01em] uppercase">
                  {section.short}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>

      {/* Same destination as the desktop CTA — /book, guarded by the proxy,
          which sends a signed-out visitor through login and back. Pointing
          this at /signup instead used to strand a member who already had an
          account on a sign-up form. */}
      <Link
        href="/book"
        className="flex min-h-11 w-12 shrink-0 flex-col items-center justify-center gap-1 rounded-3xl border border-ink py-1.5 text-ink"
      >
        <Icon name="calendar" size={20} />
        <span className="w-full text-center font-mono text-[clamp(9px,2.6vw,10px)] leading-none font-semibold tracking-[0.01em] uppercase">
          Book
        </span>
      </Link>
    </nav>
  );
}
