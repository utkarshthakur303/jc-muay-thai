"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { GalleryStrip } from "@/components/gallery/GalleryStrip";
import { packCollage } from "@/lib/gallery/collage";
import type { GalleryPhoto } from "@/lib/images/queries";

/**
 * "Preview" on the Photos screen: the home page's gallery, drawn by the
 * home page's own strip from the same list the panel is editing.
 *
 * The list above it shows one photograph per row, but the home page
 * pairs wide photographs into shared columns, and the order is what
 * decides the pairs. Until this existed the only way to see the result
 * of a move was to open the live site. It is the same `GalleryStrip`
 * fed through the same `packCollage`, so it cannot drift from the real
 * thing — a preview that was a lookalike would be wrong the first time
 * either changed.
 *
 * Three decisions:
 *
 * 1. **Mounted only while open.** The strip loads every photograph and
 *    runs a two-second timer. Neither should cost the Photos screen
 *    anything until somebody asks.
 *
 * 2. **Portalled to <body>.** `.admin-surface` reassigns `--bg` to the
 *    panel's cooler ground. Outside it, the sheet is on the site's own
 *    ground in both themes, with no colour repeated to get there.
 *
 * 3. **The home page's column, rail gap included.** On a wide screen the
 *    home page gives up `--layout-rail-offset` to the sidebar, so the
 *    strip is that much narrower there. The sheet keeps the same gap, so
 *    the photographs visible before anything scrolls are the ones a
 *    visitor sees first.
 *
 * Nothing in the sheet edits anything. Changes are made in the list and
 * go live as they always have; this only shows where they landed.
 */
export function GalleryPreview({
  photos,
}: {
  photos: readonly GalleryPhoto[];
}) {
  const [open, setOpen] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const headingId = useId();

  const columns = useMemo(() => packCollage(photos), [photos]);

  /**
   * showModal() once the portal has put the element in the document.
   * The scroll lock mirrors the lightbox's; when that lightbox opens on
   * top of this sheet it records "hidden" as the value to restore, so
   * the two nest without either releasing the other's lock.
   */
  useEffect(() => {
    if (!open) return;
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();

    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        className="flex min-h-11 items-center rounded-full border border-border px-5 font-mono text-[11px] tracking-[0.08em] text-text-2 uppercase transition-colors hover:border-accent hover:text-accent-strong"
      >
        Preview
      </button>

      {open
        ? createPortal(
            <dialog
              ref={dialogRef}
              /*
                The target check is load-bearing. The strip's lightbox is a
                <dialog> inside this one, and React propagates `close` up
                the tree even though the browser does not bubble it — so
                pressing Escape on an enlarged photograph tore the whole
                preview down with it. Measured, not supposed.
              */
              onClose={(event) => {
                if (event.target === event.currentTarget) setOpen(false);
              }}
              aria-labelledby={headingId}
              className="preview-sheet bg-bg text-text"
            >
              <div className="lg:pl-(--layout-rail-offset)">
                <div className="page-shell py-6 lg:py-10">
                  <div className="flex items-start justify-between gap-4">
                    <p className="max-w-prose pt-1 font-mono text-[11px] leading-relaxed tracking-[0.08em] text-text-2 uppercase">
                      Preview · the home page gallery as visitors see it now
                    </p>
                    <button
                      type="button"
                      onClick={() => dialogRef.current?.close()}
                      className="flex min-h-11 shrink-0 items-center rounded-full border border-border px-5 font-mono text-[11px] tracking-[0.08em] text-text-2 uppercase transition-colors hover:border-accent hover:text-accent-strong"
                    >
                      Close
                    </button>
                  </div>

                  {/* The home page's section heading, reproduced rather
                      than reused: Section carries id="gallery", which the
                      Photos screen's own heading already has. */}
                  <div className="mt-8 flex flex-wrap items-baseline justify-between gap-x-6 gap-y-3">
                    <h2
                      id={headingId}
                      className="font-display text-[clamp(2.25rem,4vw,2.75rem)] tracking-[0.01em] text-text"
                    >
                      GALLERY
                    </h2>
                    <p className="font-mono text-xs tracking-[0.06em] text-text-2 uppercase">
                      {photos.length}{" "}
                      {photos.length === 1 ? "photograph" : "photographs"}
                    </p>
                  </div>

                  <GalleryStrip columns={columns} />
                </div>
              </div>
            </dialog>,
            document.body,
          )
        : null}
    </>
  );
}
