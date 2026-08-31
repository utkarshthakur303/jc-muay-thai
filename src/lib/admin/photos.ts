import "server-only";

import { GALLERY_SLOT, type SlotId } from "@/content/imageSlots";
import { readImageFacts, type ImageFacts } from "@/lib/images/dimensions";
import { getSiteImages, type GalleryPhoto } from "@/lib/images/queries";
import { env } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";

/**
 * The panel's photograph operations.
 *
 * Every call here runs as the SIGNED-IN OWNER, not as the service role —
 * both the storage write and the table write. That is the standing rule
 * in the project's engineering rules: RLS is the enforcement. There is
 * no `isAdmin()` check in
 * this file on purpose, because a check here would look like the gate
 * while the real one sat in Postgres, and the day the two disagreed the
 * TypeScript would be believed.
 *
 * What this file owns is the ORDER of operations, which is the part that
 * decides what a half-failure leaves behind. See the note on each.
 */

export const BUCKET = "site-images";

/**
 * 8 MB, and the same number is set on the bucket itself in the
 * migration. Both exist deliberately: this one produces a sentence the
 * owner can act on, the bucket's makes the limit true for anything that
 * ever uploads — including a request that never comes through this app.
 */
export const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;

export type PhotoResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly message: string };

const ok: PhotoResult = { ok: true };
const fail = (message: string): PhotoResult => ({ ok: false, message });

const NOT_ALLOWED =
  "That change was refused. Your session may not be an admin one — sign out and back in, then try again.";

const NO_TABLE =
  "Photo management isn't switched on yet. Apply the migration 20260823120000_site_images.sql and this page starts working.";

function messageFor(code: string | undefined, fallback: string): string {
  switch (code) {
    case "42501":
      return NOT_ALLOWED;
    case "PGRST205":
    case "42P01":
      return NO_TABLE;
    case "23514":
      // A check constraint. In practice this is the alt-text rule, since
      // every other constraint is satisfied by construction above.
      return "A description is required for this photograph.";
    default:
      return fallback;
  }
}

/** The URL a public bucket object is served from. */
export function publicUrlFor(path: string): string {
  return `${env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${path}`;
}

/**
 * Everything the panel needs, in one read.
 *
 * Deliberately the SAME function the public pages use. The alternative —
 * an admin query with its own filters — is how a panel ends up showing
 * the owner something different from what visitors see, which is the one
 * thing a photo manager must never do.
 */
export async function getPhotoState() {
  return getSiteImages();
}

// ── Uploading ────────────────────────────────────────────────────────

type UploadInput = {
  /** `gallery` appends to the grid; anything else replaces that slot. */
  readonly slot: SlotId | typeof GALLERY_SLOT;
  readonly file: File;
  readonly alt: string;
  /** False for the two decorative slots — see content/imageSlots.ts. */
  readonly needsAlt: boolean;
};

export async function uploadPhoto(input: UploadInput): Promise<PhotoResult> {
  const { file, slot, alt, needsAlt } = input;

  if (!(file instanceof File) || file.size === 0) {
    return fail("No file was received. Choose a photograph and try again.");
  }

  if (file.size > MAX_UPLOAD_BYTES) {
    const mb = (file.size / 1024 / 1024).toFixed(1);
    return fail(
      `That file is ${mb} MB. The limit is 8 MB — most phones can export a smaller copy, or use "Save as" at a reduced size.`,
    );
  }

  const trimmedAlt = alt.trim();
  if (needsAlt && trimmedAlt === "") {
    return fail(
      "Please describe the photograph. It is what someone using a screen reader hears in place of the picture, and what shows if the image fails to load.",
    );
  }

  /**
   * THE FILE IS PARSED, NOT SNIFFED AT.
   *
   * `file.type` is whatever the browser chose to send and the extension
   * is whatever the file was named; neither is evidence. A `.jpeg` that
   * is really an HTML document, served from a public bucket, is stored
   * XSS waiting for somebody to open it directly.
   *
   * The same parse yields the dimensions, which next/image needs to
   * reserve the right box — so validating and measuring are one step,
   * and a file that will not measure is a file we will not store.
   */
  const bytes = new Uint8Array(await file.arrayBuffer());
  const facts = readImageFacts(bytes);
  if (!facts) {
    return fail(
      "That file could not be read as a photograph. JPEG, PNG and WebP work — a screenshot saved as a PDF, or a file renamed to .jpg, will not.",
    );
  }

  const supabase = await createClient();

  /**
   * `crypto.randomUUID`, never a name derived from the upload.
   *
   * A predictable path lets one upload silently overwrite another, and a
   * user-supplied filename is a path-traversal string the moment it
   * contains a slash. The original name is not worth keeping — nothing
   * in this app ever shows it.
   */
  const path = `${slot}/${crypto.randomUUID()}.${facts.extension}`;

  /**
   * ORDER: file first, row second.
   *
   * Get it the other way round and a failed upload leaves a row on the
   * home page pointing at a picture that does not exist — a broken image
   * for every visitor. This way a failed insert leaves a file nobody
   * references, which is invisible and costs a few hundred kilobytes,
   * and is cleaned up below anyway.
   */
  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(path, bytes, {
      contentType: facts.format,
      /**
       * A year, and it is safe because the path contains a UUID: this
       * exact byte sequence never changes. Replacing a photograph writes
       * a NEW path, so there is no cache to bust.
       */
      cacheControl: "31536000",
      upsert: false,
    });

  if (uploadError) {
    const message = uploadError.message.toLowerCase();
    if (message.includes("bucket") && message.includes("not found")) {
      return fail(NO_TABLE);
    }
    if (message.includes("row-level security") || message.includes("unauthorized")) {
      return fail(NOT_ALLOWED);
    }
    return fail("That photograph could not be uploaded. Please try again.");
  }

  const written = await writeRow({
    slot,
    src: publicUrlFor(path),
    alt: needsAlt ? trimmedAlt : "",
    facts,
    storagePath: path,
  });

  if (!written.ok) {
    // The row is what makes a file mean anything. Without one this is
    // dead weight, so it goes back out rather than accumulating in a
    // bucket nobody has a screen for.
    await supabase.storage.from(BUCKET).remove([path]);
    return written;
  }

  return ok;
}

async function writeRow(input: {
  slot: SlotId | typeof GALLERY_SLOT;
  src: string;
  alt: string;
  facts: ImageFacts;
  storagePath: string;
}): Promise<PhotoResult> {
  const supabase = await createClient();
  const { slot, src, alt, facts, storagePath } = input;

  const values = {
    src,
    alt,
    width: facts.width,
    height: facts.height,
    storage_path: storagePath,
  };

  if (slot === GALLERY_SLOT) {
    // Appended, not prepended. A new photograph joining the end of the
    // grid is what the owner expects; silently jumping the queue would
    // reorder a page he arranged on purpose.
    const { gallery } = await getSiteImages();
    const nextPosition =
      gallery.reduce((highest, photo) => Math.max(highest, photo.position), -1) + 1;

    const { error } = await supabase
      .from("site_images")
      .insert({ slot: GALLERY_SLOT, position: nextPosition, ...values });

    return error
      ? fail(messageFor(error.code, "That photograph could not be saved."))
      : ok;
  }

  /**
   * A fixed slot holds at most one picture, enforced by the partial
   * unique index. Replacing therefore means updating the existing row if
   * there is one and inserting if there is not — and the row may legitimately
   * not exist, because reverting a slot deletes it.
   */
  const existing = await findSlotRow(slot);
  const { error } = existing
    ? await supabase.from("site_images").update(values).eq("id", existing)
    : await supabase
        .from("site_images")
        .insert({ slot, position: 0, ...values });

  return error
    ? fail(messageFor(error.code, "That photograph could not be saved."))
    : ok;
}

/** The row id currently occupying a fixed slot, if any. */
async function findSlotRow(slot: SlotId): Promise<string | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("site_images")
    .select("id")
    .eq("slot", slot)
    .maybeSingle();

  return typeof data?.id === "string" ? data.id : null;
}

// ── Removing ─────────────────────────────────────────────────────────

/**
 * Delete a row and, if it owns a stored file, the file with it.
 *
 * ORDER: row first, file second — the exact reverse of the upload, and
 * for the same reason read backwards. A deleted file whose row survives
 * is a broken image on the home page, seen by every visitor. A deleted
 * row whose file survives is an orphan nobody can see. Given a
 * half-failure, take the orphan.
 *
 * The client chose on 2026-08-23 that the file goes too. It is
 * irreversible, and the button says so before it is pressed.
 */
export async function removePhoto(id: string): Promise<PhotoResult> {
  const supabase = await createClient();

  /**
   * Read the path BEFORE deleting the row — afterwards there is nothing
   * left to say which file belonged to it, and the file would be
   * stranded permanently.
   */
  const { data: row } = await supabase
    .from("site_images")
    .select("storage_path")
    .eq("id", id)
    .maybeSingle();

  const { data: deleted, error } = await supabase
    .from("site_images")
    .delete()
    .eq("id", id)
    .select("id");

  if (error) {
    return fail(messageFor(error.code, "That photograph could not be removed."));
  }

  /**
   * ROWS AFFECTED, NOT THE STATUS CODE.
   *
   * PostgREST answers a policy-filtered DELETE with HTTP 200 and an
   * empty array, not 403 — the trap that made an earlier RLS test in
   * this project report every refused write as "allowed". Zero rows back
   * means the policy declined.
   */
  if (!deleted || deleted.length === 0) return fail(NOT_ALLOWED);

  const path = typeof row?.storage_path === "string" ? row.storage_path : null;
  if (path) {
    const { data: purged, error: storageError } = await supabase.storage
      .from(BUCKET)
      .remove([path]);

    /**
     * THE SAME TRAP AS POSTGREST, IN A SECOND PLACE.
     *
     * `.remove()` answers a refused delete with HTTP 200 and an EMPTY
     * ARRAY — no error, no exception, nothing to catch. Checking only
     * `storageError` reports a deletion that did not happen, which is
     * exactly what shipped on 2026-08-23: the rows went, every file
     * stayed, and the panel said "Photograph removed."
     *
     * The cause was a missing SELECT policy on storage.objects — the
     * delete could not SEE the object, so it deleted nothing and called
     * that success. Fixed in 20260823130000. This check is what makes
     * the next such failure visible instead of silent.
     */
    if (storageError || !purged || purged.length === 0) {
      // The picture IS off the site, which is what was asked for. Saying
      // so beats reporting a failure that would send the owner back to
      // press a button that has already worked.
      return fail(
        "The photograph is off the site, but its file could not be deleted from storage. Nothing is broken — mention it if it keeps happening.",
      );
    }
  }

  return ok;
}

// ── Reordering ───────────────────────────────────────────────────────

/**
 * Move one gallery photograph up or down.
 *
 * Buttons rather than drag-and-drop, decided 2026-08-15: this panel has
 * to work on a phone standing in the gym, and a drag target is the one
 * interaction that has no keyboard equivalent without writing one.
 *
 * Renumbers every row that is out of place rather than swapping two
 * values. A swap assumes positions are already 0..n-1 with no gaps and
 * no duplicates; nothing enforces that, and a single bad assumption
 * there makes two photographs share a position and their order depend on
 * whatever Postgres feels like returning. On a swap this still writes
 * exactly two rows — it just also repairs the list if it was ever
 * damaged.
 */
export async function moveGalleryPhoto(
  id: string,
  direction: "up" | "down",
): Promise<PhotoResult> {
  const { gallery, source } = await getSiteImages();
  if (source !== "database") return fail(NO_TABLE);

  const index = gallery.findIndex((photo) => photo.id === id);
  if (index === -1) {
    return fail("That photograph is no longer in the gallery.");
  }

  const target = direction === "up" ? index - 1 : index + 1;
  if (target < 0 || target >= gallery.length) {
    // The panel hides the button at either end, so reaching this means
    // two tabs disagreed about the order. Not an error worth alarming
    // anybody with.
    return ok;
  }

  const reordered: GalleryPhoto[] = [...gallery];
  const [moved] = reordered.splice(index, 1);
  if (!moved) return fail("That photograph is no longer in the gallery.");
  reordered.splice(target, 0, moved);

  const supabase = await createClient();

  for (const [position, photo] of reordered.entries()) {
    if (photo.position === position) continue;
    const { error } = await supabase
      .from("site_images")
      .update({ position })
      .eq("id", photo.id);
    if (error) {
      return fail(messageFor(error.code, "The order could not be changed."));
    }
  }

  return ok;
}

// ── Editing the description ──────────────────────────────────────────

export async function updateAlt(
  id: string,
  alt: string,
  needsAlt: boolean,
): Promise<PhotoResult> {
  const trimmed = alt.trim();
  if (needsAlt && trimmed === "") {
    return fail("A description is required for this photograph.");
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("site_images")
    .update({ alt: trimmed })
    .eq("id", id)
    .select("id");

  if (error) {
    return fail(messageFor(error.code, "That description could not be saved."));
  }
  if (!data || data.length === 0) return fail(NOT_ALLOWED);

  return ok;
}
