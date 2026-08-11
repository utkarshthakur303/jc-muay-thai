"use client";

import Link from "next/link";

import { StreakButton } from "@/components/attendance/StreakButton";
import { useActiveSection } from "@/components/layout/ActiveSection";
import { Icon, LogoMark } from "@/components/ui/Icon";
import { navSections, site } from "@/content/site";

/**
 * The orange rail — the signature element of the approved design. Desktop
 * only; below lg it is replaced by MobileNav, not shrunk.
 *
 * Colour note: the rail is solid accent in both themes, and everything on
 * it is drawn in ink. That is a brand decision, not an oversight — the rail
 * is the logo's surface. Contrast was measured against the accent, not
 * assumed: ink on accent is 7.9:1, and the muted inactive label at 70%
 * alpha composites to 4.7:1, which clears AA for its 10px size.
 *
 * Height, at five sections: 40px padding + 72px logo + five 52px items with
 * 6px gaps + 58px for the streak item + 60px for the booking button = 534px,
 * so the rail needs a 582px viewport. Below that the section list scrolls
 * inside itself and everything else stays put — see the note on the scroll
 * container below, which is why the streak sits outside it.
 */
export function SidebarRail() {
  const active = useActiveSection();

  return (
    <nav
      aria-label="Sections"
      className="fixed inset-y-6 left-6 z-40 hidden w-22 flex-col items-center rounded-[38px] bg-accent py-5 shadow-rail lg:flex"
    >
      <Link
        href="/"
        aria-label={`${site.name} — home`}
        className="mb-7 flex size-11 shrink-0 items-center justify-center rounded-full bg-ink text-accent"
      >
        <LogoMark />
      </Link>

      {/*
        `flex-1` deliberately does NOT live here any more. It used to, which
        pushed everything after the list to the bottom of the rail — that is
        where the streak control ended up, and the client has asked for it
        directly under Contact instead. The spacer below now absorbs the
        free space, so the list is exactly as tall as its five items.

        `overflow-y-auto` stays as the short-viewport guard, and its scope
        is why the streak is not inside it: an element with `overflow-y`
        set to anything but visible clips on BOTH axes — CSS forces the
        other axis to `auto` — so a 320px panel opening sideways out of
        this box would be cut off at the rail's edge.
      */}
      <ul
        role="list"
        className="flex min-h-0 shrink flex-col items-center gap-1.5 overflow-y-auto"
      >
        {navSections.map((section) => {
          const isActive = active === section.id;
          return (
            <li key={section.id}>
              <Link
                href={`#${section.id}`}
                aria-current={isActive ? "location" : undefined}
                className={`flex w-16 flex-col items-center justify-center gap-1.5 rounded-2xl px-1 py-2 transition-colors ${
                  isActive
                    ? "bg-ink text-accent"
                    : // A colour shift alone left the target's edges
                      // invisible — you could see the label brighten but
                      // not what you were about to click. The tint draws
                      // the actual hit area.
                      "text-ink/85 hover:bg-ink/10 hover:text-ink"
                }`}
              >
                <Icon name={section.icon} />
                <span className="font-mono text-[10px] leading-none tracking-[0.04em] uppercase">
                  {section.label}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>

      {/*
        Directly under Contact, and outside the <ul>, because it is not a
        section of this page — the same reasoning that keeps the booking
        button out of the list. It renders nothing at all for a signed-out
        visitor, and the gap above it closes with it; see StreakButton.
      */}
      <StreakButton placement="rail" />

      {/*
        Holds the booking button at the foot of the rail. A `mt-auto` on the
        button itself would collapse to nothing when the rail is full,
        putting the CTA hard against the streak item.
      */}
      <div aria-hidden className="min-h-3 flex-1" />

      <Link
        href="/signup"
        aria-label="Book your free class"
        className="flex size-12 shrink-0 items-center justify-center rounded-full text-ink transition-colors hover:bg-ink hover:text-accent"
      >
        <Icon name="calendar" size={22} />
      </Link>
    </nav>
  );
}
