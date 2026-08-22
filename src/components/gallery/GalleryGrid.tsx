"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";

import type { GalleryPhoto } from "@/lib/images/queries";

/**
 * The gallery, and the lightbox that opens out of it.
 *
 * WHY THIS IS NOW WORTH BUILDING
 *
 * The section's own comment used to argue against a lightbox, and the
 * argument was about cost: focus trap, Escape, focus restoration, an
 * inert background, aria-modal, scroll lock. Every one of those is
 * hand-written work that is easy to get subtly wrong and invisible when
 * you do.
 *
 * Native `<dialog>` with `showModal()` supplies all of them from the
 * platform. Focus is trapped inside the dialog, Escape closes it, focus
 * returns to the element that opened it, the rest of the page is made
 * inert, and it renders in the top layer so no z-index on the fixed rail
 * can cover it. What is left to write is a size cap, a close button and
 * the arrows — which is a fair price for the feature the client asked
 * for.
 *
 * WHAT IS STILL HAND-WRITTEN, AND WHY
 *
 * Scroll lock. A modal dialog does not stop the page behind it scrolling,
 * so the body is locked while it is open — and `scrollbar-gutter: stable`
 * in globals.css is what stops that lock shifting the whole page sideways
 * as the scrollbar disappears.
 *
 * WHY THE ARROWS EXIST
 *
 * A gallery where seeing the next photograph means closing this one and
 * finding the next thumbnail is a lightbox that has been half-built. They
 * wrap, because with three images a dead end at either edge is reached
 * immediately.
 */

export function GalleryGrid({ images }: { images: readonly GalleryPhoto[] }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [index, setIndex] = useState(0);
  const [open, setOpen] = useState(false);

  const show = useCallback((next: number) => {
    setIndex(next);
    setOpen(true);
    // Only ever called from a click handler, so the dialog is already
    // mounted — it ships in the markup closed rather than being created
    // on demand.
    dialogRef.current?.showModal();
  }, []);

  const close = useCallback(() => {
    dialogRef.current?.close();
  }, []);

  const step = useCallback(
    (delta: number) => {
      setIndex((current) => (current + delta + images.length) % images.length);
    },
    [images.length],
  );

  /**
   * The body lock, tied to the open state rather than to the click, so
   * closing by Escape or by the backdrop unlocks it too — those paths do
   * not run through any handler of ours.
   */
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  const current = images[index];

  return (
    <>
      <ul role="list" className="mt-7 columns-1 gap-4 sm:columns-2 lg:columns-3">
        {images.map((image, position) => (
          <li key={image.id} className="mb-4 break-inside-avoid">
            {/*
              A button, not a div with a click handler. This is now a real
              control and has to be reachable by keyboard and announced as
              pressable.

              `aria-label` carries the description plus what pressing it
              does, and overrides the image's alt inside it so nothing is
              read twice. The alt stays on the image regardless: if the
              JavaScript never arrives, the picture still has its
              description.
            */}
            <button
              type="button"
              onClick={() => show(position)}
              aria-label={`View larger: ${image.alt}`}
              aria-haspopup="dialog"
              className="card-hover photo-frame block w-full cursor-zoom-in overflow-hidden rounded-3xl border border-border"
            >
              <Image
                src={image.src}
                alt={image.alt}
                width={image.width}
                height={image.height}
                // One column below sm, two below lg, three above —
                // matching the column-count steps exactly. Getting this
                // wrong is what makes a phone download a 2560px file to
                // paint it 343px wide.
                sizes="(max-width: 639px) 100vw, (max-width: 1023px) 50vw, 30vw"
                className="h-auto w-full"
              />
            </button>
          </li>
        ))}
      </ul>

      <dialog
        ref={dialogRef}
        // Fires for every close path — the button, Escape, the backdrop —
        // which is why the lock is released here and not in a handler.
        onClose={() => setOpen(false)}
        // Clicking the backdrop. The event target is the dialog itself
        // only when the click landed outside its contents, because the
        // contents fill the dialog's own box.
        onClick={(event) => {
          if (event.target === dialogRef.current) close();
        }}
        onKeyDown={(event) => {
          if (event.key === "ArrowRight") {
            event.preventDefault();
            step(1);
          }
          if (event.key === "ArrowLeft") {
            event.preventDefault();
            step(-1);
          }
        }}
        aria-label="Gallery"
        className="lightbox m-auto"
      >
        {/* The dialog fills the viewport so the backdrop click above has
            somewhere to land; this box is what the photograph sits in. */}
        <div className="flex h-dvh w-screen flex-col items-center justify-center gap-3 p-4 sm:p-8">
          {current ? (
            <Image
              key={current.id}
              src={current.src}
              alt={current.alt}
              width={current.width}
              height={current.height}
              sizes="100vw"
              /* `object-contain` inside a capped box: the photograph is
                 shown whole. Cropping in a view whose entire purpose is
                 seeing more of the picture would be perverse. */
              className="max-h-[80dvh] w-auto max-w-full rounded-2xl object-contain"
            />
          ) : null}

          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={() => step(-1)}
              aria-label="Previous photograph"
              className="flex size-11 items-center justify-center rounded-full border border-chalk/30 text-chalk transition-colors hover:border-accent hover:text-accent"
            >
              <span aria-hidden>‹</span>
            </button>

            <p
              aria-hidden
              className="min-w-16 text-center font-mono text-[11px] tracking-widest text-chalk/70 tabular-nums"
            >
              {index + 1} / {images.length}
            </p>

            <button
              type="button"
              onClick={() => step(1)}
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
    </>
  );
}
