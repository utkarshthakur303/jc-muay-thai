"use client";

import { useCallback } from "react";

import { Icon } from "@/components/ui/Icon";

const STORAGE_KEY = "jc-theme";

/**
 * Flips <html data-theme>, which re-points every theme variable in
 * globals.css and repaints the whole site.
 *
 * Deliberately stateless. The DOM attribute already holds the theme — the
 * inline script in the root layout sets it before first paint — so keeping
 * a React copy would create a second source of truth that can disagree
 * with what is on screen, and would force the server to guess a value it
 * cannot know.
 *
 * Both icons are always rendered; `only-dark` / `only-light` decide which
 * is visible in CSS. The accessible name is direction-neutral because the
 * server cannot know the current theme, and a name that is wrong half the
 * time is worse than one that is general.
 */
export function ThemeToggle({ className = "" }: { className?: string }) {
  const toggle = useCallback(() => {
    const root = document.documentElement;
    const next = root.dataset.theme === "light" ? "dark" : "light";
    root.dataset.theme = next;
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Safari in private mode and hardened browsers throw here. The
      // theme still applies for this page view; only persistence is lost,
      // which is not worth breaking the click over.
    }
  }, []);

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label="Switch colour theme"
      className={`flex size-11 shrink-0 items-center justify-center rounded-full border border-border bg-card text-accent-strong transition-colors hover:border-accent ${className}`}
    >
      <Icon name="sun" className="only-dark" />
      <Icon name="moon" className="only-light" />
    </button>
  );
}
