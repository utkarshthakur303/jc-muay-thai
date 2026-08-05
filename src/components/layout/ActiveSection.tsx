"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";

/**
 * Tracks which section the reader is currently looking at, so the nav can
 * say where they are.
 *
 * One observer, shared through context, rather than a hook called by each
 * nav surface. The desktop rail and the mobile bar are both mounted at all
 * times (only one is visible, via CSS) — a per-component hook would mean
 * two observers doing identical work forever, and two pieces of state that
 * could disagree.
 */

const ActiveSectionContext = createContext<string | null>(null);

export function useActiveSection(): string | null {
  return useContext(ActiveSectionContext);
}

export function ActiveSectionProvider({
  sectionIds,
  children,
}: {
  sectionIds: readonly string[];
  children: React.ReactNode;
}) {
  const [active, setActive] = useState<string | null>(sectionIds[0] ?? null);

  // Effects may not depend on an array identity — a parent re-render would
  // tear down and rebuild the observer every time. Depend on the contents.
  const key = sectionIds.join(",");

  useEffect(() => {
    const ids = key.split(",").filter(Boolean);
    const elements = ids
      .map((id) => document.getElementById(id))
      .filter((el): el is HTMLElement => el !== null);

    if (elements.length === 0) return;

    const visible = new Set<string>();

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) visible.add(entry.target.id);
          else visible.delete(entry.target.id);
        }
        // Pick the section highest in document order rather than whichever
        // entry fired last. Callback order is not defined when two
        // sections cross the band together, so trusting it makes the
        // highlight flicker on a fast scroll.
        const current = ids.find((id) => visible.has(id));
        if (current) setActive(current);
      },
      {
        // Only the middle tenth of the viewport counts as "here". A
        // section is active when the reader's eye is on it, not when a
        // pixel of it has entered from the bottom.
        rootMargin: "-45% 0px -45% 0px",
        threshold: 0,
      },
    );

    for (const element of elements) observer.observe(element);
    return () => observer.disconnect();
  }, [key]);

  const value = useMemo(() => active, [active]);

  return (
    <ActiveSectionContext.Provider value={value}>
      {children}
    </ActiveSectionContext.Provider>
  );
}
