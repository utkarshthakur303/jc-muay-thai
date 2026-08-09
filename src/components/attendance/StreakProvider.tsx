"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";

import { loadStreak, markToday, unmarkToday } from "@/lib/attendance/actions";
import type { StreakSummary } from "@/lib/attendance/types";

/**
 * Holds the member's streak for the whole page.
 *
 * WHY THE DATA IS FETCHED IN THE BROWSER
 *
 * The home page is statically generated and served from the CDN edge —
 * one cached HTML document for every visitor, no Supabase round-trip in
 * front of a marketing page. Reading the session during render would end
 * that for the one page carrying all the traffic, in exchange for a widget
 * only signed-in members can even see.
 *
 * So the shell renders with a placeholder and the numbers arrive after
 * mount. The trigger itself is not waiting on this: it ships in the HTML
 * inside `.member-only`, and the pre-paint script in layout.tsx has
 * already decided whether to show it from a cookie. A member sees the
 * flame in the first painted frame and its number a moment later; a guest
 * never sees either, and neither of them costs the page its cache.
 *
 * ONE PROVIDER, TWO TRIGGERS
 *
 * The rail and the mobile bar both render a trigger, and only one is
 * visible at a time. They share this context so the page makes one request
 * rather than two, and so a check-in from either surface updates both.
 */

type StreakContextValue = {
  readonly summary: StreakSummary | null;
  readonly loading: boolean;
  readonly pending: boolean;
  readonly error: boolean;
  readonly mark: () => void;
  readonly unmark: () => void;
};

const StreakContext = createContext<StreakContextValue | null>(null);

/** Null outside a provider, so a trigger rendered elsewhere degrades quietly. */
export function useStreak() {
  return useContext(StreakContext);
}

export function StreakProvider({ children }: { children: React.ReactNode }) {
  const [summary, setSummary] = useState<StreakSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(false);

  /**
   * Guards against a second write landing while the first is in flight —
   * a double tap on a slow connection, which would otherwise resolve out
   * of order and briefly show the older of the two answers.
   */
  const inFlight = useRef(false);

  useEffect(() => {
    let cancelled = false;

    /**
     * Guests are not asked about. The attribute is set before paint from
     * the display cookie, so this runs only for someone who is actually
     * signed in — the alternative is every anonymous visitor to the home
     * page making a pointless authenticated round-trip that can only ever
     * come back null.
     */
    if (!document.documentElement.hasAttribute("data-member")) {
      setLoading(false);
      return;
    }

    loadStreak()
      .then((next) => {
        if (cancelled) return;
        setSummary(next);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const run = useCallback((action: () => Promise<StreakSummary | null>) => {
    if (inFlight.current) return;
    inFlight.current = true;
    setPending(true);
    setError(false);

    action()
      .then((next) => {
        // A null here means the session went away mid-session — an
        // expired token, a sign-out in another tab. Leaving the old
        // numbers on screen would be a lie; clearing them lets the
        // panel say so.
        setSummary(next);
      })
      .catch(() => setError(true))
      .finally(() => {
        inFlight.current = false;
        setPending(false);
      });
  }, []);

  const mark = useCallback(() => run(markToday), [run]);
  const unmark = useCallback(() => run(unmarkToday), [run]);

  return (
    <StreakContext.Provider
      value={{ summary, loading, pending, error, mark, unmark }}
    >
      {children}
    </StreakContext.Provider>
  );
}
