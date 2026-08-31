import { GalleryStrip } from "@/components/gallery/GalleryStrip";
import { Section } from "@/components/layout/Section";
import { packCollage } from "@/lib/gallery/collage";
import type { GalleryPhoto } from "@/lib/images/queries";

/**
 * Photographs of the gym.
 *
 * ── IT USED TO BE A MASONRY GRID ────────────────────────────────────
 * Three CSS columns, one photograph per cell, the whole set on screen at
 * once. That worked at five photographs. The client asked on 2026-08-31
 * for something that takes as many as the gym can produce, and a grid
 * answers that by growing downwards until the gallery is the longest
 * section on a page whose other four sections are the actual product.
 *
 * So it scrolls sideways instead. Height is fixed whatever the count;
 * fifty photographs cost exactly as much page as five.
 *
 * ── WHY THE PACKING HAPPENS HERE, ON THE SERVER ─────────────────────
 * `packCollage` groups the photographs into columns that each stand
 * exactly one strip tall — a portrait alone, two landscapes stacked —
 * so nothing is cropped and the top and bottom of the strip are a
 * straight line. The client chose that over uniform cards on
 * 2026-08-31: these are pictures of people standing at full height, and
 * a square card takes their heads off.
 *
 * It returns fractions rather than pixels, which is what lets it run
 * here instead of in the browser. Measuring the container and packing
 * to a real width would mean the collage assembling itself after
 * hydration — a reflow on every visit, and a client component wrapping
 * the layout of a page that must stay statically prerendered
 * (the first of the project's engineering rules). This runs once at
 * build time and
 * ships as numbers.
 *
 * Only the scroller below it is interactive, so only that ships
 * JavaScript.
 *
 * ── AN EMPTY GALLERY REMOVES THE SECTION ────────────────────────────
 * Not an empty strip, not a "photographs coming soon" line — the
 * section is not rendered at all and the page closes up around it. The
 * client chose this on 2026-08-23 over the built-in photographs
 * reappearing, which would have meant deleting them did not stick.
 *
 * This is the one place the whole feature can change the shape of the
 * home page, so the panel says it out loud on the Photos screen rather
 * than leaving the owner to find out by looking at the live site.
 */
export function GallerySection({
  photos,
}: {
  photos: readonly GalleryPhoto[];
}) {
  if (photos.length === 0) return null;

  const columns = packCollage(photos);

  return (
    <Section
      id="gallery"
      title="GALLERY"
      meta={`${photos.length} ${photos.length === 1 ? "photograph" : "photographs"}`}
      intro="The gym, and the nights it trains for — weigh-ins, corners, belts and the people who turn up for all of it. Swipe, or tap any photograph to see it full size."
    >
      <GalleryStrip columns={columns} />
    </Section>
  );
}
