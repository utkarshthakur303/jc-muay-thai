"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { PackedColumn } from "@/lib/gallery/collage";
import {
  atEnd,
  atStart,
  canScroll,
  nextScroll,
  previousScroll,
  scrollProgress,
  type ScrollSpan,
  type StripMetrics,
} from "@/lib/gallery/scroll";
import type { GalleryPhoto } from "@/lib/images/queries";

/**
 * The gallery: a collage that scrolls sideways, moves on by itself, and
 * opens any photograph full size.
 *
 * ── WHAT MOVES IT ───────────────────────────────────────────────────
 * Native scrolling, and nothing else. No transform on a track, no
 * duplicated slides, no width arithmetic in JavaScript. That one choice
 * pays for most of this file: swiping works because it is a scroller,
 * momentum and rubber-banding are the platform's, tabbing to a
 * photograph scrolls it into view for free, and the auto-advance is a
 * `scrollTo` that the user can interrupt mid-flight with a finger
 * without anything getting out of step. Where the next stop IS is
 * arithmetic, and it lives in lib/gallery/scroll.ts where it can be
 * tested; this file only measures and applies.
 *
 * ── WHAT STOPS IT, AND WHY THERE ARE SO MANY WAYS ───────────────────
 * The client asked for a two-second auto-advance. Content that moves on
 * its own has to be stoppable — WCAG 2.2.2, and plainly right besides,
 * since two seconds is faster than some people read. So it stops when:
 *
 *   · the Pause button is pressed, and stays stopped;
 *   · a mouse is over it, or anything inside it has keyboard focus;
 *   · the lightbox is open — the photograph being read must not change;
 *   · the strip is scrolled off screen, so it is not cycling at nobody;
 *   · the tab is in the background;
 *   · for six seconds after any swipe, wheel, key or arrow press, so a
 *     person looking at one photograph is not dragged off it;
 *   · the visitor has asked their device for less motion, in which case
 *     it never starts — but the Play button still works, because that
 *     preference is about what happens unasked.
 *
 * Pointer type is checked before hover pauses anything. `mouseenter`
 * fires on a tap on a phone and never fires `mouseleave`, so hovering
 * naively would leave the strip permanently frozen on exactly the
 * devices the swipe was built for.
 *
 * ── WHAT DOES NOT RE-RENDER ─────────────────────────────────────────
 * The progress line is a CSS custom property written straight to the
 * node, like the card tilt. Sixty React renders a second across sixteen
 * next/image children, to move one bar, is not a trade worth making.
 * The edge fades ARE state, because they flip twice a lap rather than
 * sixty times a second.
 */

const STEP_MS = 2000;
/** How long a human touch keeps the timer off. */
const HOLD_MS = 6000;

export function GalleryStrip({
  columns,
}: {
  columns: readonly PackedColumn<GalleryPhoto>[];
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLUListElement>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);

  const [playing, setPlaying] = useState(true);
  const [engaged, setEngaged] = useState(false);
  const [onScreen, setOnScreen] = useState(false);
  const scrollable = columns.length > 1;
  const [edges, setEdges] = useState({ before: false, after: scrollable });
  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState(0);

  const holdUntil = useRef(0);
  const reduced = useRef(false);

  /** The lightbox steps through every photograph, ignoring the columns. */
  const photos = useMemo(
    () => columns.flatMap((column) => column.photos.map((item) => item.photo)),
    [columns],
  );

  const hold = useCallback(() => {
    holdUntil.current = Date.now() + HOLD_MS;
  }, []);

  const step = useCallback((direction: 1 | -1) => {
    const track = trackRef.current;
    if (!track) return;

    const trackLeft = track.getBoundingClientRect().left;
    const metrics: StripMetrics = {
      scrollLeft: track.scrollLeft,
      clientWidth: track.clientWidth,
      scrollWidth: track.scrollWidth,
      // Read from the boxes themselves rather than from `offsetLeft`,
      // which is relative to whichever ancestor happens to be positioned
      // and quietly changes meaning if one ever is.
      columnStarts: Array.from(track.children, (column) => {
        return column.getBoundingClientRect().left - trackLeft + track.scrollLeft;
      }),
    };

    const target =
      direction === 1 ? nextScroll(metrics) : previousScroll(metrics);
    if (target === null) return;

    track.scrollTo({
      left: target,
      // "auto" defers to the stylesheet, which says smooth. Only
      // "instant" actually refuses to animate.
      behavior: reduced.current ? "instant" : "smooth",
    });
  }, []);

  /** Progress straight onto the node; edges through state. */
  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;

    let frame = 0;
    const read = () => {
      frame = 0;
      const span: ScrollSpan = {
        scrollLeft: track.scrollLeft,
        clientWidth: track.clientWidth,
        scrollWidth: track.scrollWidth,
      };
      barRef.current?.style.setProperty(
        "--strip-progress",
        String(scrollProgress(span)),
      );
      const before = !atStart(span);
      const after = !atEnd(span);
      setEdges((current) =>
        current.before === before && current.after === after
          ? current
          : { before, after },
      );
    };
    const schedule = () => {
      if (frame) return;
      frame = requestAnimationFrame(read);
    };

    read();
    track.addEventListener("scroll", schedule, { passive: true });
    // Rotation, a resized window, and the moment a web font lands and
    // every column reflows — all of which move the edges without anyone
    // scrolling.
    const observer = new ResizeObserver(schedule);
    observer.observe(track);

    return () => {
      track.removeEventListener("scroll", schedule);
      observer.disconnect();
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  /** Don't cycle a strip nobody is looking at. */
  useEffect(() => {
    const root = rootRef.current;
    if (!root || typeof IntersectionObserver === "undefined") {
      setOnScreen(true);
      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) => setOnScreen(entry?.isIntersecting ?? true),
      { threshold: 0.15 },
    );
    observer.observe(root);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => {
      reduced.current = query.matches;
      // Turning the preference on stops it. Turning it off does not
      // start it again — that would be the site deciding to move on
      // somebody's behalf, which is the thing being avoided.
      if (query.matches) setPlaying(false);
    };
    apply();
    query.addEventListener("change", apply);
    return () => query.removeEventListener("change", apply);
  }, []);

  /**
   * A gallery of one has nowhere to advance to. Without this the timer
   * still runs every two seconds for the life of the page, measuring the
   * strip and finding nothing to do — which the client can produce by
   * deleting photographs until one is left.
   */
  const running = playing && !engaged && !open && onScreen && scrollable;

  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => {
      // A background tab throttles timers rather than stopping them, so
      // this is checked here rather than trusted to the interval.
      if (document.visibilityState !== "visible") return;
      if (Date.now() < holdUntil.current) return;
      step(1);
    }, STEP_MS);
    return () => window.clearInterval(id);
  }, [running, step]);

  const show = useCallback((position: number) => {
    setIndex(position);
    setOpen(true);
    dialogRef.current?.showModal();
  }, []);

  const close = useCallback(() => dialogRef.current?.close(), []);

  const stepLightbox = useCallback(
    (delta: number) => {
      setIndex(
        (current) => (current + delta + photos.length) % photos.length,
      );
    },
    [photos.length],
  );

  /**
   * A modal dialog does not stop the page behind it scrolling.
   * `scrollbar-gutter: stable` in globals.css is what keeps this lock
   * from shifting the whole page sideways as the scrollbar goes.
   */
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  const current = photos[index];

  return (
    <div
      ref={rootRef}
      className="mt-7"
      onPointerEnter={(event) => {
        if (event.pointerType === "mouse") setEngaged(true);
      }}
      onPointerLeave={(event) => {
        if (event.pointerType === "mouse") setEngaged(false);
      }}
      onFocusCapture={() => setEngaged(true)}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) {
          setEngaged(false);
        }
      }}
    >
      <ul
        ref={trackRef}
        role="list"
        aria-label="Photographs of the gym"
        data-more-before={String(edges.before)}
        data-more-after={String(edges.after)}
        onPointerDown={hold}
        onWheel={hold}
        onKeyDown={hold}
        className="photo-strip"
      >
        {columns.map((column, columnIndex) => (
          <li
            key={column.photos[0]?.photo.id ?? columnIndex}
            className="photo-strip-column"
            style={{ "--col-w": column.width } as React.CSSProperties}
          >
            {column.photos.map((item) => {
              const position = photos.indexOf(item.photo);
              return (
                <button
                  key={item.photo.id}
                  type="button"
                  onClick={() => show(position)}
                  aria-label={`View larger: ${item.photo.alt}`}
                  aria-haspopup="dialog"
                  className="photo-strip-cell card-hover photo-frame block w-full cursor-zoom-in rounded-2xl border border-border"
                  style={{ "--cell-h": item.height } as React.CSSProperties}
                >
                  <Image
                    src={item.photo.src}
                    alt={item.photo.alt}
                    width={item.photo.width}
                    height={item.photo.height}
                    /*
                      The box is this photograph's own shape, so cover and
                      contain agree to within the sub-pixel the two ways
                      of rounding disagree by. Cover is chosen so that
                      rounding shows as a hair off an edge rather than as
                      a hairline of card showing through.
                    */
                    className="size-full object-cover"
                    /*
                      Per photograph, from the column it actually landed
                      in: `--strip-h` at each breakpoint times this
                      column's width. A 0.46 portrait asks for a third of
                      what the widest tile does, instead of every
                      photograph in the gallery quoting the widest case.
                    */
                    sizes={sizesFor(column.width)}
                  />
                </button>
              );
            })}
          </li>
        ))}
      </ul>

      {scrollable ? (
        <div className="mt-4 flex items-center gap-3">
          <div
            ref={barRef}
            aria-hidden
            className="strip-progress h-0.5 min-w-0 flex-1 rounded-full bg-border"
          />

          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={() => {
                hold();
                step(-1);
              }}
              aria-label="Scroll the gallery back"
              className="flex size-11 items-center justify-center rounded-full border border-border text-text-2 transition-colors hover:border-accent hover:text-accent"
            >
              <span aria-hidden>‹</span>
            </button>

            <button
              type="button"
              onClick={() => setPlaying((on) => !on)}
              aria-label={
                playing
                  ? "Pause the gallery moving on by itself"
                  : "Play the gallery, moving on by itself"
              }
              className="flex size-11 items-center justify-center rounded-full border border-border text-text-2 transition-colors hover:border-accent hover:text-accent"
            >
              <span aria-hidden className="font-mono text-[11px]">
                {playing ? "❙❙" : "▶"}
              </span>
            </button>

            <button
              type="button"
              onClick={() => {
                hold();
                step(1);
              }}
              aria-label="Scroll the gallery forwards"
              className="flex size-11 items-center justify-center rounded-full border border-border text-text-2 transition-colors hover:border-accent hover:text-accent"
            >
              <span aria-hidden>›</span>
            </button>
          </div>
        </div>
      ) : null}

      <dialog
        ref={dialogRef}
        onClose={() => setOpen(false)}
        onClick={(event) => {
          if (event.target === dialogRef.current) close();
        }}
        onKeyDown={(event) => {
          if (event.key === "ArrowRight") {
            event.preventDefault();
            stepLightbox(1);
          }
          if (event.key === "ArrowLeft") {
            event.preventDefault();
            stepLightbox(-1);
          }
        }}
        aria-label="Gallery"
        className="lightbox m-auto"
      >
        <div className="flex h-dvh w-screen flex-col items-center justify-center gap-3 p-4 sm:p-8">
          {current ? (
            <Image
              key={current.id}
              src={current.src}
              alt={current.alt}
              width={current.width}
              height={current.height}
              sizes="100vw"
              /* Whole, and uncropped — the one view whose entire purpose
                 is seeing more of the picture. */
              className="max-h-[80dvh] w-auto max-w-full rounded-2xl object-contain"
            />
          ) : null}

          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={() => stepLightbox(-1)}
              aria-label="Previous photograph"
              className="flex size-11 items-center justify-center rounded-full border border-chalk/30 text-chalk transition-colors hover:border-accent hover:text-accent"
            >
              <span aria-hidden>‹</span>
            </button>

            <p
              aria-hidden
              className="min-w-16 text-center font-mono text-[11px] tracking-widest text-chalk/70 tabular-nums"
            >
              {index + 1} / {photos.length}
            </p>

            <button
              type="button"
              onClick={() => stepLightbox(1)}
              aria-label="Next photograph"
              className="flex size-11 items-center justify-center rounded-full border border-chalk/30 text-chalk transition-colors hover:border-accent hover:text-accent"
            >
              <span aria-hidden>›</span>
            </button>

            <button
              type="button"
              onClick={close}
              aria-label="Close gallery"
              className="ml-2 flex min-h-11 items-center rounded-full border border-chalk/30 px-5 font-mono text-[11px] tracking-[0.08em] text-chalk uppercase transition-colors hover:border-accent hover:text-accent"
            >
              Close
            </button>
          </div>
        </div>
      </dialog>
    </div>
  );
}

/**
 * The three `--strip-h` values from globals.css, multiplied by the width
 * this column actually came out at. Kept in step by hand, and worth it:
 * a gallery of twenty photographs that all quote the widest tile
 * downloads several times what it needs to.
 */
function sizesFor(columnWidth: number): string {
  const rem = (base: number) => `${(base * columnWidth).toFixed(2)}rem`;
  return [
    `(min-width: 64rem) ${rem(27)}`,
    `(min-width: 40rem) ${rem(21)}`,
    rem(17),
  ].join(", ");
}
