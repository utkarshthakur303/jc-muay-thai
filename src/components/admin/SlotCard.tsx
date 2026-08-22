"use client";

import Image from "next/image";
import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";

import type { ImageSlot } from "@/content/imageSlots";
import { PhotoUploadForm } from "@/components/admin/PhotoUploadForm";
import { removePhotoAction, updateAltAction } from "@/lib/admin/actions";
import { initialAdminState } from "@/lib/admin/state";
import type { SiteImage } from "@/lib/images/queries";

/**
 * One fixed position in the layout — the hero, the trial strip, a class
 * card.
 *
 * ── WHY "REVERT" AND NOT "DELETE" ───────────────────────────────────
 * These slots are not a list. The hero card cannot render without a
 * photograph, so a Delete button on it would be a control that either
 * breaks the home page or quietly does something other than what it
 * says.
 *
 * What it does instead is drop the row, and a slot with no row falls
 * back to the picture compiled into the build — see BUILT_IN_SLOTS in
 * lib/images/queries.ts. So one button honestly means "put the original
 * back", and the only slot where that leaves nothing at all is Kids,
 * whose original is deliberately no photograph.
 *
 * The button is therefore hidden when the current picture IS the
 * built-in one: reverting to what you are already looking at is a
 * control that does nothing.
 * ────────────────────────────────────────────────────────────────────
 */

function Pending({ idle, busy }: { idle: string; busy: string }) {
  const { pending } = useFormStatus();
  return <>{pending ? busy : idle}</>;
}

export function SlotCard({
  slot,
  image,
  editable,
}: {
  slot: ImageSlot;
  image: SiteImage | null;
  /** False on the fallback path, where no row exists to change. */
  editable: boolean;
}) {
  const [altState, saveAlt] = useActionState(updateAltAction, initialAdminState);
  const [revertState, revert] = useActionState(removePhotoAction, initialAdminState);
  const [open, setOpen] = useState(false);

  // A stored file means the owner put this one here. No stored file means
  // it is the photograph that shipped with the site.
  const isCustom = image !== null && image.storagePath !== null;
  const previewShape = slot.shapes[0];

  return (
    <section
      aria-labelledby={`slot-${slot.id}`}
      className="card-surface rounded-card border border-border px-5 py-5 sm:px-6"
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:gap-5">
        <div
          className="w-full shrink-0 overflow-hidden rounded-2xl border border-border bg-input-bg sm:w-40"
          style={previewShape ? { aspectRatio: `${previewShape.ratio}` } : undefined}
        >
          {image ? (
            /* `object-cover` and the slot's own ratio, so this thumbnail
               is cropped exactly the way the real page crops it. */
            <Image
              src={image.src}
              alt=""
              width={image.width}
              height={image.height}
              sizes="160px"
              className="size-full object-cover"
            />
          ) : (
            <div className="flex size-full items-center justify-center p-3">
              <p className="text-center font-mono text-[10px] tracking-[0.08em] text-text-3 uppercase">
                No photograph
              </p>
            </div>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <h3
            id={`slot-${slot.id}`}
            className="font-display text-2xl tracking-[0.02em] text-text"
          >
            {slot.label}
          </h3>
          <p className="mt-1 max-w-prose text-[13px] leading-relaxed text-text-2">
            {slot.where}
          </p>

          <p className="mt-2 font-mono text-[10px] tracking-[0.12em] text-text-3 uppercase">
            {image
              ? `${isCustom ? "Yours" : "Built in"} · `
              : "Empty · "}
            {image ? (
              <span className="tabular-nums">
                {image.width}×{image.height}
              </span>
            ) : (
              "nothing to show"
            )}
          </p>

          {/*
            Only Kids has one of these, and it is the reason that card
            has no photograph rather than an oversight somebody should
            "fix" with the nearest available picture of an adult.
          */}
          {image === null && slot.emptyNote ? (
            <p className="mt-3 max-w-prose rounded-2xl border border-border px-4 py-3 text-[13px] leading-relaxed text-text-2">
              {slot.emptyNote}
            </p>
          ) : null}

          {editable ? (
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setOpen((was) => !was)}
                aria-expanded={open}
                className="flex min-h-11 items-center rounded-full border border-border px-5 font-mono text-[11px] tracking-[0.08em] text-text-2 uppercase transition-colors hover:border-accent hover:text-accent-strong"
              >
                {open ? "Cancel" : image ? "Replace" : "Add a photograph"}
              </button>

              {isCustom ? (
                <form action={revert}>
                  <input type="hidden" name="id" value={image.id} />
                  <button
                    type="submit"
                    className="flex min-h-11 items-center rounded-full border border-border px-5 font-mono text-[11px] tracking-[0.08em] text-text-2 uppercase transition-colors hover:border-danger hover:text-danger"
                  >
                    <Pending idle="Put the original back" busy="Reverting…" />
                  </button>
                </form>
              ) : null}
            </div>
          ) : null}

          {/*
            Editing the description without re-uploading. Only offered on
            a slot that needs one and has a real row behind it — the
            built-in pictures have no row to update, and the two
            decorative slots have nothing to say.
          */}
          {editable && slot.needsAlt && isCustom ? (
            <form action={saveAlt} className="mt-4 flex flex-col gap-2">
              <input type="hidden" name="id" value={image.id} />
              <input type="hidden" name="slot" value={slot.id} />
              <label
                className="block font-mono text-[10px] tracking-[0.12em] text-text-3 uppercase"
                htmlFor={`slot-alt-${slot.id}`}
              >
                Description
              </label>
              <textarea
                id={`slot-alt-${slot.id}`}
                name="alt"
                rows={2}
                required
                defaultValue={image.alt}
                className="w-full rounded-2xl border border-border bg-input-bg px-4 py-2.5 text-sm leading-relaxed text-text focus:border-accent focus:outline-none"
              />
              <button
                type="submit"
                className="flex min-h-11 w-fit items-center rounded-full border border-border px-5 font-mono text-[11px] tracking-[0.08em] text-text-2 uppercase transition-colors hover:border-accent hover:text-accent-strong"
              >
                <Pending idle="Save description" busy="Saving…" />
              </button>
            </form>
          ) : null}

          {altState.status !== "idle" && altState.message ? (
            <p
              role="status"
              className={`mt-2 text-[13px] leading-relaxed ${
                altState.status === "error" ? "text-danger" : "text-text-2"
              }`}
            >
              {altState.message}
            </p>
          ) : null}

          {revertState.status === "error" && revertState.message ? (
            <p role="status" className="mt-2 text-[13px] leading-relaxed text-danger">
              {revertState.message}
            </p>
          ) : null}
        </div>
      </div>

      {open && editable ? (
        <div className="mt-5 border-t border-border pt-4">
          <PhotoUploadForm
            slot={slot.id}
            shapes={slot.shapes}
            needsAlt={slot.needsAlt}
            submitLabel={image ? "Replace photograph" : "Add photograph"}
            currentAlt={image?.alt}
          />
        </div>
      ) : null}
    </section>
  );
}
