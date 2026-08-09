"use client";

import { useEffect, type RefObject } from "react";

/**
 * Escape-to-close and press-outside-to-close, for anything that opens over
 * the page.
 *
 * Extracted when the streak panel needed exactly what the schedule note
 * already had. Two hand-written copies of this would have drifted — the
 * second one would quietly lose the focus restore, or listen on click
 * instead of pointerdown, and nobody would notice because both still
 * *look* like they close.
 *
 * Two details that are easy to get wrong and matter:
 *
 * `pointerdown`, not `click`. A click listener fires after the press has
 * already moved focus, so pressing a link behind an open panel closes the
 * panel and follows the link in an order that reads as a misclick.
 * pointerdown resolves on the press itself.
 *
 * Focus goes back to the trigger on Escape. Without it, a keyboard user
 * who dismisses a panel is returned to the top of the document and has to
 * tab all the way back to where they were.
 */
export function useDismissable({
  open,
  onDismiss,
  containerRef,
  triggerRef,
}: {
  open: boolean;
  onDismiss: () => void;
  /** The panel and its trigger — a press inside this is not "outside". */
  containerRef: RefObject<HTMLElement | null>;
  triggerRef: RefObject<HTMLElement | null>;
}) {
  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      onDismiss();
      triggerRef.current?.focus();
    };

    const onPointerDown = (event: PointerEvent) => {
      if (containerRef.current?.contains(event.target as Node)) return;
      onDismiss();
    };

    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("pointerdown", onPointerDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [open, onDismiss, containerRef, triggerRef]);
}
