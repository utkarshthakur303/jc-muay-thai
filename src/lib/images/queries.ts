import { galleryImages } from "@/content/gallery";
import {
  ALL_SLOT_VALUES,
  GALLERY_SLOT,
  IMAGE_SLOTS,
  isSlotId,
  type SlotId,
} from "@/content/imageSlots";
import { env } from "@/lib/env";

/**
 * Reading the site's photographs.
 *
 * ── A BARE fetch, FOR THE SAME REASON AS THE TIMETABLE ──────────────
 * `/` must stay statically prerendered — the first non-negotiable in
 * CLAUDE.md. `lib/supabase/server.ts` calls `cookies()`, and touching
 * `cookies()` during render opts the whole route out of static
 * generation silently: the build output flips from `○ (Static)` to
 * `ƒ (Dynamic)` and nothing else complains.
 *
 * These pictures are the same for every visitor and have no per-user
 * component whatsoever, so they are fetched with the publishable key
 * over plain HTTP, no session, no cookies. `site_images_read_all` grants
 * SELECT to `anon` deliberately: they are photographs printed on a
 * public web page.
 *
 * Next's fetch cache then makes it free — one request at build time,
 * reused until the owner actually changes a picture and the action calls
 * `updateTag(IMAGES_TAG)`.
 * ────────────────────────────────────────────────────────────────────
 */

export const IMAGES_TAG = "site-images";

export type SiteImage = {
  readonly id: string;
  readonly src: string;
  readonly alt: string;
  readonly width: number;
  readonly height: number;
  /**
   * Path inside the storage bucket, or null for the photographs shipped
   * in the repository. Null is what tells the panel there is no file to
   * delete and no way to revert further.
   */
  readonly storagePath: string | null;
};

export type GalleryPhoto = SiteImage & { readonly position: number };

/**
 * Where the pictures came from.
 *
 * `fallback` means the migration has not been applied, or Supabase could
 * not be reached — the site draws the photographs compiled into the
 * build. The public pages are identical either way. The PANEL is what
 * cares: a built-in picture has no row and no id, so a Replace button
 * over one is a control that cannot do what it says.
 */
export type ImagesSource = "database" | "fallback";

export type SiteImages = {
  readonly gallery: readonly GalleryPhoto[];
  readonly slots: Readonly<Record<SlotId, SiteImage | null>>;
  readonly source: ImagesSource;
};

/**
 * The photographs compiled into the build.
 *
 * Not a placeholder set — this is literally what the site showed before
 * the pictures moved into the database, so a failed read degrades to the
 * previous version of the site rather than to a blank page. `class-kids`
 * is null because it has always been null; see src/content/classes.ts.
 */
const BUILT_IN_SLOTS: Readonly<Record<SlotId, SiteImage | null>> = {
  hero: builtIn("/images/hero.jpeg", "", 2560, 1706),
  promo: builtIn("/images/promo.jpeg", "", 1706, 2560),
  "class-beginner": builtIn(
    "/images/beginner.jpeg",
    "A student drilling strikes on a heavy bag",
    1531,
    2560,
  ),
  "class-intermediate": builtIn(
    "/images/intermediate.jpeg",
    "Two training partners working Thai pads",
    2560,
    1706,
  ),
  "class-advanced": builtIn(
    "/images/advanced.jpeg",
    "A coach and fighter sparring in the ring",
    2560,
    1706,
  ),
  "class-kids": null,
};

function builtIn(
  src: string,
  alt: string,
  width: number,
  height: number,
): SiteImage {
  return { id: `built-in:${src}`, src, alt, width, height, storagePath: null };
}

type ImageRow = {
  readonly id: string;
  readonly slot: string;
  readonly position: number;
  readonly src: string;
  readonly alt: string;
  readonly width: number;
  readonly height: number;
  readonly storage_path: string | null;
};

/**
 * Rows are validated, not trusted, and an unreadable row is DROPPED
 * rather than defaulted — the same rule as the timetable, for a sharper
 * reason. A defaulted `src` is a broken image on the home page; a
 * defaulted `width` is the wrong box reserved for it and a visible
 * layout shift on every load. Neither is better than the picture quietly
 * not being there, and the missing one is obvious to the owner the
 * moment he looks at the panel.
 */
function toImage(row: ImageRow): (SiteImage & { slot: string; position: number }) | null {
  if (typeof row.id !== "string" || row.id === "") return null;
  if (typeof row.slot !== "string" || !ALL_SLOT_VALUES.includes(row.slot)) return null;
  if (typeof row.src !== "string" || row.src.trim() === "") return null;
  if (typeof row.alt !== "string") return null;
  if (!isPositiveInt(row.width) || !isPositiveInt(row.height)) return null;

  return {
    id: row.id,
    slot: row.slot,
    position: isPositiveInt(row.position) || row.position === 0 ? row.position : 0,
    src: row.src,
    alt: row.alt,
    width: row.width,
    height: row.height,
    storagePath:
      typeof row.storage_path === "string" && row.storage_path !== ""
        ? row.storage_path
        : null,
  };
}

function isPositiveInt(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value > 0;
}

export async function getSiteImages(): Promise<SiteImages> {
  const url =
    `${env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/site_images` +
    `?select=id,slot,position,src,alt,width,height,storage_path` +
    `&order=position.asc`;

  try {
    const response = await fetch(url, {
      headers: {
        apikey: env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
        Authorization: `Bearer ${env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY}`,
      },
      next: { tags: [IMAGES_TAG] },
    });

    if (!response.ok) return fallback();

    const rows: unknown = await response.json();
    // A missing table comes back as a JSON object describing the error,
    // not an array — which is exactly the distinction that matters here.
    if (!Array.isArray(rows)) return fallback();

    const parsed = rows
      .map((row) => toImage(row as ImageRow))
      .filter((image): image is NonNullable<ReturnType<typeof toImage>> => image !== null);

    /**
     * AN EMPTY GALLERY IS A REAL ANSWER, AND THIS IS WHERE THAT IS
     * DECIDED.
     *
     * The timetable's read treats zero rows as "nobody has seeded this"
     * and shows the built-in week, because a gym with no classes is not
     * a thing the site should render. Photographs are the opposite: a
     * gym with no photographs is perfectly ordinary, and the client's
     * call on 2026-08-23 was that removing them all should make the
     * section disappear rather than resurrect the stock ones.
     *
     * So the fallback here is keyed on whether the table could be READ,
     * not on whether it had anything in it. A successful fetch that
     * returns `[]` means the owner emptied it, and that is honoured.
     */
    const gallery = parsed
      .filter((image) => image.slot === GALLERY_SLOT)
      .sort((a, b) => a.position - b.position)
      .map(({ slot: _slot, ...image }) => image);

    const slots: Record<string, SiteImage | null> = {};
    for (const slot of IMAGE_SLOTS) {
      const row = parsed.find((image) => image.slot === slot.id);
      /**
       * A slot with no row falls back to the built-in picture, which is
       * what makes "revert" a DELETE rather than a second kind of
       * update. `class-kids` has no built-in, so absent means absent —
       * which is its correct resting state.
       */
      slots[slot.id] = row
        ? {
            id: row.id,
            src: row.src,
            alt: row.alt,
            width: row.width,
            height: row.height,
            storagePath: row.storagePath,
          }
        : BUILT_IN_SLOTS[slot.id];
    }

    return {
      gallery,
      slots: slots as Record<SlotId, SiteImage | null>,
      source: "database",
    };
  } catch {
    return fallback();
  }
}

function fallback(): SiteImages {
  return {
    gallery: galleryImages.map((image, position) => ({
      id: `built-in:${image.src}`,
      src: image.src,
      alt: image.alt,
      width: image.width,
      height: image.height,
      storagePath: null,
      position,
    })),
    slots: BUILT_IN_SLOTS,
    source: "fallback",
  };
}
