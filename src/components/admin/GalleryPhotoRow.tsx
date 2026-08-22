"use client";

import Image from "next/image";
import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";

import type { GalleryPhoto } from "@/lib/images/queries";
import { updateAltAction } from "@/lib/admin/actions";
import { initialAdminState } from "@/lib/admin/state";

/**
 * One photograph in the gallery: what it looks like, what it says, where
 * it sits, and how to get rid of it.
 *
 * ── THE REMOVE BUTTON IS TWO STEPS, DELIBERATELY ────────────────────
 * The client's call on 2026-08-23 was that removing a photograph deletes
 * the file from storage as well — clean, and irreversible. A single
 * click that permanently destroys the gym's only copy of a photograph of
 * its own members is not a control that should be one thumb-width from
 * "move up".
 *
 * So the first press asks, and the second acts, and the question says
 * what will actually happen rather than "are you sure?". No `confirm()`:
 * it is unstyleable, it reads as a browser malfunction on a phone, and
 * it says nothing about what is being lost.
 * ────────────────────────────────────────────────────────────────────
 */

const ICON_BUTTON =
  "flex size-11 items-center justify-center rounded-full border border-border text-text-2 transition-colors hover:border-accent hover:text-accent-strong disabled:cursor-not-allowed disabled:opacity-40";

function Pending({ idle, busy }: { idle: string; busy: string }) {
  const { pending } = useFormStatus();
  return <>{pending ? busy : idle}</>;
}

export function GalleryPhotoRow({
  photo,
  index,
  total,
  editable,
  remove,
  move,
}: {
  photo: GalleryPhoto;
  index: number;
  total: number;
  /**
   * False on the fallback path, where these rows are the photographs
   * compiled into the build rather than records in a table.
   *
   * Every control below is hidden when it is false, and that is not
   * cosmetic: a built-in row's id is a synthetic string, not a uuid, so
   * Remove and Save would be refused the moment they were pressed. A
   * button that cannot do what it says does not ship — the standing
   * instruction that deleted the mockup's fake "3 spots left" drawer.
   */
  editable: boolean;
  /**
   * Owned by GalleryList, not by this row.
   *
   * Removing a photograph unmounts this component, so an error it
   * returned could never be rendered here — see the header of
   * GalleryList. The row dispatches; the list reports.
   */
  remove: (formData: FormData) => void;
  move: (formData: FormData) => void;
}) {
  const [altState, saveAlt] = useActionState(updateAltAction, initialAdminState);
  const [confirming, setConfirming] = useState(false);

  return (
    <li className="flex flex-col gap-4 border-b border-border py-5 last:border-b-0 sm:flex-row sm:gap-5">
      <div className="flex items-start gap-3">
        {/*
          Ordering controls sit beside the picture rather than under the
          row, so "move this one up" is anchored to the thing it moves.
          Buttons rather than drag: decided 2026-08-15, because a drag
          target has no keyboard equivalent unless one is written, and
          this panel has to work on a phone.
        */}
        {editable ? (
        <div className="flex flex-col gap-2">
          <form action={move}>
            <input type="hidden" name="id" value={photo.id} />
            <input type="hidden" name="direction" value="up" />
            <button
              type="submit"
              disabled={index === 0}
              className={ICON_BUTTON}
              aria-label={`Move photograph ${index + 1} earlier`}
            >
              <span aria-hidden>↑</span>
            </button>
          </form>
          <form action={move}>
            <input type="hidden" name="id" value={photo.id} />
            <input type="hidden" name="direction" value="down" />
            <button
              type="submit"
              disabled={index === total - 1}
              className={ICON_BUTTON}
              aria-label={`Move photograph ${index + 1} later`}
            >
              <span aria-hidden>↓</span>
            </button>
          </form>
        </div>
        ) : null}

        <div className="relative w-28 shrink-0 overflow-hidden rounded-2xl border border-border sm:w-36">
          <Image
            src={photo.src}
            alt=""
            width={photo.width}
            height={photo.height}
            sizes="144px"
            className="h-auto w-full"
          />
        </div>
      </div>

      <div className="min-w-0 flex-1">
        <p className="font-mono text-[10px] tracking-[0.12em] text-text-3 uppercase">
          {index + 1} of {total}
          {photo.storagePath === null ? " · built in" : ""}
          {" · "}
          <span className="tabular-nums">
            {photo.width}×{photo.height}
          </span>
        </p>

        {editable ? (
        <>
        <form action={saveAlt} className="mt-2 flex flex-col gap-2">
          <input type="hidden" name="id" value={photo.id} />
          <input type="hidden" name="slot" value="gallery" />
          <label className="sr-only" htmlFor={`alt-${photo.id}`}>
            Description of this photograph
          </label>
          <textarea
            id={`alt-${photo.id}`}
            name="alt"
            rows={2}
            required
            defaultValue={photo.alt}
            className="w-full rounded-2xl border border-border bg-input-bg px-4 py-2.5 text-sm leading-relaxed text-text focus:border-accent focus:outline-none"
          />
          <button
            type="submit"
            className="flex min-h-11 w-fit items-center rounded-full border border-border px-5 font-mono text-[11px] tracking-[0.08em] text-text-2 uppercase transition-colors hover:border-accent hover:text-accent-strong"
          >
            <Pending idle="Save description" busy="Saving…" />
          </button>
        </form>

        {/*
          Outside the description form, and it has to be: a <form> inside
          a <form> is invalid HTML, and the browser resolves it by
          dropping the inner one — so "Yes, delete it" would have
          submitted the description instead. React renders exactly what it
          is given here and says nothing.
        */}
        <div className="mt-2 flex flex-wrap items-center gap-2">
          {confirming ? (
            <form action={remove} className="flex flex-wrap items-center gap-2">
              <input type="hidden" name="id" value={photo.id} />
              <button
                type="submit"
                className="flex min-h-11 items-center rounded-full bg-danger px-5 font-mono text-[11px] font-semibold tracking-[0.08em] text-chalk uppercase transition-opacity hover:opacity-90"
              >
                <Pending idle="Yes, delete it" busy="Deleting…" />
              </button>
              <button
                type="button"
                onClick={() => setConfirming(false)}
                className="flex min-h-11 items-center rounded-full border border-border px-5 font-mono text-[11px] tracking-[0.08em] text-text-2 uppercase transition-colors hover:border-accent hover:text-accent-strong"
              >
                Keep it
              </button>
            </form>
          ) : (
            <button
              type="button"
              onClick={() => setConfirming(true)}
              className="flex min-h-11 items-center rounded-full border border-border px-5 font-mono text-[11px] tracking-[0.08em] text-text-2 uppercase transition-colors hover:border-danger hover:text-danger"
            >
              Remove
            </button>
          )}
        </div>

        {confirming ? (
          <p className="mt-2 max-w-prose text-[12px] leading-relaxed text-danger">
            This takes the photograph off the site and deletes the file. It
            cannot be undone — you would need your own copy to put it back.
          </p>
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

        </>
        ) : (
          <p className="mt-2 max-w-prose text-[13px] leading-relaxed text-text-2">
            {photo.alt}
          </p>
        )}
      </div>
    </li>
  );
}
