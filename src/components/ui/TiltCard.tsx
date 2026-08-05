"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Pointer-reactive tilt — the signature interaction of the approved
 * mockup, kept, but rebuilt so it can never fire where it does not belong.
 *
 * Why it survives review when most hover flourishes should not:
 *   - it is compositor-only (a transform), so it never triggers layout or
 *     paint, and costs nothing on the main thread;
 *   - it is off for coarse pointers, so a phone never carries the listener;
 *   - it is off under prefers-reduced-motion, which is a vestibular
 *     accessibility requirement, not a preference;
 *   - the transform lives in CSS (the `tilt` utility), so those two rules
 *     are enforced by media query and hold even if this component were to
 *     attach a listener it should not have.
 *
 * Writes CSS variables directly on the node rather than going through
 * React state. Re-rendering a card on every pointermove — up to 120 times
 * a second on a high-refresh display — would put reconciliation in the
 * path of a purely visual effect.
 */

/** Degrees of rotation at the card's edge. Matches the approved mockup. */
const MAX_TILT_DEG = 7;
const HOVER_SCALE = 1.02;

type TiltCardProps = {
  children: React.ReactNode;
  className?: string;
};

export function TiltCard({ children, className = "" }: TiltCardProps) {
  const ref = useRef<HTMLDivElement>(null);
  const frame = useRef<number | null>(null);
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    const pointer = window.matchMedia("(hover: hover) and (pointer: fine)");
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");

    const sync = () => setEnabled(pointer.matches && !motion.matches);
    sync();

    // People change these mid-session — plugging in a mouse, or turning on
    // Reduce Motion because something on the page made them queasy.
    pointer.addEventListener("change", sync);
    motion.addEventListener("change", sync);
    return () => {
      pointer.removeEventListener("change", sync);
      motion.removeEventListener("change", sync);
    };
  }, []);

  useEffect(() => {
    return () => {
      if (frame.current !== null) cancelAnimationFrame(frame.current);
    };
  }, []);

  const handleMove = (event: React.PointerEvent<HTMLDivElement>) => {
    // A hybrid laptop reports hover:hover and still gets touched. Tilting
    // under a finger puts the card in motion beneath the thing that moved
    // it, which reads as a glitch.
    if (!enabled || event.pointerType !== "mouse") return;

    const { clientX, clientY } = event;
    if (frame.current !== null) cancelAnimationFrame(frame.current);

    frame.current = requestAnimationFrame(() => {
      const element = ref.current;
      if (!element) return;

      const rect = element.getBoundingClientRect();
      const x = (clientX - rect.left) / rect.width;
      const y = (clientY - rect.top) / rect.height;

      // Tracking must feel attached to the cursor, so the settle
      // transition is swapped out while the pointer is inside.
      element.style.transitionDuration = "60ms";
      element.style.transitionTimingFunction = "linear";
      element.style.willChange = "transform";
      element.style.setProperty("--tilt-x", `${(0.5 - y) * MAX_TILT_DEG * 2}deg`);
      element.style.setProperty("--tilt-y", `${(x - 0.5) * MAX_TILT_DEG * 2}deg`);
      element.style.setProperty("--tilt-scale", String(HOVER_SCALE));
    });
  };

  const handleLeave = () => {
    if (frame.current !== null) {
      cancelAnimationFrame(frame.current);
      frame.current = null;
    }

    const element = ref.current;
    if (!element) return;

    // Hand the settle back to the `tilt` utility's easing.
    element.style.transitionDuration = "";
    element.style.transitionTimingFunction = "";
    element.style.removeProperty("--tilt-x");
    element.style.removeProperty("--tilt-y");
    element.style.removeProperty("--tilt-scale");

    // will-change promotes the card to its own compositor layer, which
    // costs GPU memory. Holding it on every card for the life of the page
    // is how a five-card grid quietly becomes a memory problem on a
    // low-end phone. Release it once the card is at rest.
    window.setTimeout(() => {
      if (ref.current) ref.current.style.willChange = "";
    }, 500);
  };

  return (
    <div
      ref={ref}
      onPointerMove={handleMove}
      onPointerLeave={handleLeave}
      className={`tilt ${className}`}
    >
      {children}
    </div>
  );
}
