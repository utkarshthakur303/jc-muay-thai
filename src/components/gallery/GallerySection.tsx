import { GalleryGrid } from "@/components/gallery/GalleryGrid";
import { Section } from "@/components/layout/Section";
import type { GalleryPhoto } from "@/lib/images/queries";

/**
 * Photographs of the training floor.
 *
 * Layout is CSS multi-column rather than a fixed grid, for one reason:
 * every image keeps its own aspect ratio and nothing is cropped. A grid
 * with a shared aspect box would centre-crop whatever the client sends,
 * and the thing a gym photographs is people — cropping a face out of a
 * photo of your own students is not a defensible default. Column count
 * steps 1 → 2 → 3 with width, and the layout does not care how many
 * images exist, which matters because today there are three and the
 * client has been asked for a dozen.
 *
 * The mockup hardcoded a pixel height per image, which meant the browser
 * letterboxed or squashed anything whose real proportions differed. Here
 * the intrinsic dimensions come from the files themselves, so next/image
 * reserves exactly the right box before a byte arrives and the section
 * contributes nothing to layout shift.
 *
 * There IS now a lightbox, and this comment used to argue there should
 * not be. The argument was about cost — focus trap, Escape, focus
 * restoration, scroll lock, aria-modal — all of which is hand-written work
 * that is easy to get subtly wrong. The client asked for click-to-enlarge,
 * and the honest answer turned out to be that native `<dialog>` supplies
 * almost every item on that list from the platform. See GalleryGrid.
 *
 * Still deliberately absent: `priority`. This is the fourth section down;
 * preloading it would take bandwidth from the hero, which is the page's
 * LCP element. next/image lazy-loads by default and that is correct.
 *
 * One caveat worth knowing: CSS columns fill top-to-bottom, column by
 * column, so the visual order is not the DOM order once there is more than
 * one row. That is fine for photographs, which carry no sequence. It would
 * not be fine for anything that reads as a list of steps.
 *
 * This stays a Server Component; only the grid below it is interactive, so
 * only the grid ships JavaScript.
 *
 * ── AN EMPTY GALLERY REMOVES THE SECTION ────────────────────────────
 * Not an empty grid, not a "photographs coming soon" line — the section
 * is not rendered at all, and the page closes up around it. The client
 * chose this on 2026-08-23 over the alternative of the built-in
 * photographs reappearing, which would have meant deleting them did not
 * stick.
 *
 * This is the one place the whole feature can change the shape of the
 * home page, so it is worth being blunt about: the panel says so out
 * loud on the Photos screen rather than leaving the owner to discover it
 * by looking at the live site.
 * ────────────────────────────────────────────────────────────────────
 */
export function GallerySection({
  photos,
}: {
  photos: readonly GalleryPhoto[];
}) {
  if (photos.length === 0) return null;

  return (
    <Section
      id="gallery"
      title="GALLERY"
      intro="Bag work, pad rounds and sparring — the ordinary week at the gym. Tap any photograph to see it full size."
    >
      <GalleryGrid images={photos} />
    </Section>
  );
}
