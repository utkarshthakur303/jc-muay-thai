"use client";

import { useEffect, useRef, useState } from "react";

import { SCHEDULE_NOTE } from "@/content/schedule";

/**
 * The standing timetable caveat, folded into a quiet disclosure.
 *
 * Its history is a study in one sentence being given the wrong volume
 * twice. The mockup ran it as an infinite scrolling marquee — loud,
 * unpausable, duplicated in the DOM so a screen reader read it twice. That
 * was replaced by a full-width accent-tinted panel with an accent border,
 * which fixed the accessibility problem and created a design one: the
 * loudest element in the section was a footnote about summer, sitting above
 * the timetable it qualifies and shouting over it.
 *
 * This is the third try and the honest one. A caveat is not news. It is
 * true every day of the year, most visitors do not need it, and the ones
 * who do are looking for it. So it gets a quiet line of grey text that
 * opens into it — present, findable, and no longer competing with the
 * schedule for attention.
 *
 * Why a disclosure rather than a tooltip: the content is a sentence people
 * need to read at their own pace. A hover tooltip is unreachable on touch,
 * vanishes when the pointer drifts, and under WCAG 1.4.13 would owe you
 * dismissible / hoverable / persistent behaviour anyway. A button that
 * toggles is simpler and works on every input device.
 *
 * The panel is only in the DOM while open, which is deliberate: an
 * `aria-expanded` button whose content is permanently present but visually
 * hidden gets announced twice by some screen readers.
 */
export function ScheduleNote() {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setOpen(false);
      // Focus must come back, or a keyboard user who dismisses the panel
      // is returned to the top of the document.
      buttonRef.current?.focus();
    };

    /**
     * pointerdown, not click: a click listener fires after the press has
     * already moved focus, so a member pressing a link behind the panel
     * would see it close and the link fire in an order that looks like a
     * misclick. pointerdown closes on the press itself.
     */
    const onPointerDown = (event: PointerEvent) => {
      if (wrapperRef.current?.contains(event.target as Node)) return;
      setOpen(false);
    };

    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("pointerdown", onPointerDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [open]);

  return (
    <div ref={wrapperRef} className="relative mt-4 inline-block">
      <button
        ref={buttonRef}
        type="button"
        aria-expanded={open}
        aria-controls="schedule-note-panel"
        onClick={() => setOpen((value) => !value)}
        className="flex min-h-11 items-center gap-2 font-mono text-[11px] tracking-[0.08em] text-text-3 uppercase transition-colors hover:text-accent-strong"
      >
        <span
          aria-hidden
          className="flex size-4 shrink-0 items-center justify-center rounded-full border border-current text-[9px] leading-none"
        >
          i
        </span>
        Schedule notes
      </button>

      {open ? (
        <div
          id="schedule-note-panel"
          role="note"
          className="pop-in absolute top-full left-0 z-20 w-[19rem] max-w-[calc(100vw-2.5rem)] rounded-2xl border border-border bg-card p-4 text-sm leading-relaxed text-text-2 shadow-float"
        >
          {SCHEDULE_NOTE}
        </div>
      ) : null}
    </div>
  );
}
