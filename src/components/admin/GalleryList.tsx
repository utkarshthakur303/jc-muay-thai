"use client";

import { useActionState } from "react";

import { GalleryPhotoRow } from "@/components/admin/GalleryPhotoRow";
import { movePhotoAction, removePhotoAction } from "@/lib/admin/actions";
import { initialAdminState } from "@/lib/admin/state";
import type { GalleryPhoto } from "@/lib/images/queries";

/**
 * The gallery list, and the one place its errors can actually be seen.
 *
 * ── WHY THE ACTIONS LIVE HERE AND NOT ON EACH ROW ───────────────────
 * They used to live on the row, which was wrong in a way that only
 * appears at runtime: **removing a photograph unmounts the component
 * holding the result of removing it.** The row disappears, and the
 * error state it was about to render goes with it.
 *
 * That is not hypothetical. On 2026-08-23 every file deletion was
 * failing — a missing SELECT policy on storage.objects, so the delete
 * matched nothing and returned 200 — and `removePhoto` correctly
 * returned "the file could not be deleted". Nobody ever saw it. The row
 * vanished, the message vanished with it, and the panel looked like it
 * had worked perfectly.
 *
 * So the action belongs to the thing that SURVIVES the action. The list
 * outlives any row in it, and the notice below renders whatever the last
 * attempt reported.
 *
 * Move stays here too, for symmetry and because a reorder that is
 * refused should say so somewhere stable rather than under whichever row
 * happened to be pressed.
 * ────────────────────────────────────────────────────────────────────
 */
export function GalleryList({
  photos,
  editable,
}: {
  photos: readonly GalleryPhoto[];
  editable: boolean;
}) {
  const [removeState, remove] = useActionState(removePhotoAction, initialAdminState);
  const [moveState, move] = useActionState(movePhotoAction, initialAdminState);

  // Success is already visible — the photograph is gone, or it moved.
  // Only the things the page cannot show by itself are worth saying.
  const problem =
    removeState.status === "error"
      ? removeState.message
      : moveState.status === "error"
        ? moveState.message
        : null;

  return (
    <>
      <ul role="list" className="mt-2 flex flex-col">
        {photos.map((photo, index) => (
          <GalleryPhotoRow
            key={photo.id}
            photo={photo}
            index={index}
            total={photos.length}
            editable={editable}
            remove={remove}
            move={move}
          />
        ))}
      </ul>

      {problem ? (
        <p
          role="status"
          className="mt-3 rounded-card border border-danger px-5 py-4 text-sm leading-relaxed text-danger"
        >
          {problem}
        </p>
      ) : null}
    </>
  );
}
