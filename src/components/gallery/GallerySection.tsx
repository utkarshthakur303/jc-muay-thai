import Image from "next/image";

import { Section } from "@/components/layout/Section";
import { galleryImages } from "@/content/gallery";

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
 * Two things deliberately absent:
 *
 *   - No lightbox. A modal is the most expensive component on any site to
 *     get right — focus trap, Escape, focus restoration, scroll lock,
 *     aria-modal, reduced-motion — and the payoff here would be a larger
 *     view of an image that holds no detail worth magnifying. If the
 *     client sends photographs where the detail matters, it earns its
 *     cost then.
 *   - No `priority`. This is the fourth section down; preloading it would
 *     take bandwidth from the hero, which is the page's LCP element.
 *     next/image lazy-loads by default and that is the correct behaviour.
 *
 * One caveat worth knowing: CSS columns fill top-to-bottom, column by
 * column, so the visual order is not the DOM order once there is more than
 * one row. That is fine for photographs, which carry no sequence. It would
 * not be fine for anything that reads as a list of steps.
 */
export function GallerySection() {
  return (
    <Section
      id="gallery"
      title="GALLERY"
      intro="Bag work, pad rounds and sparring — the ordinary week at the gym."
    >
      <ul role="list" className="mt-7 columns-1 gap-4 sm:columns-2 lg:columns-3">
        {galleryImages.map((image) => (
          <li
            key={image.src}
            /*
              The frame carries the border, the radius and the clipping;
              the image inside it grows very slightly under the pointer.
              Deliberately 5% and slow: a photo grid that leaps at the
              cursor implies a lightbox, and there isn't one. This reads
              as the surface acknowledging you, not as an offer.
            */
            className="card-hover photo-frame mb-4 break-inside-avoid rounded-3xl border border-border"
          >
            <Image
              src={image.src}
              alt={image.alt}
              width={image.width}
              height={image.height}
              // One column below sm, two below lg, three above — matching
              // the column-count steps exactly. Getting this wrong is what
              // makes a phone download a 2560px file to paint it 343px
              // wide.
              sizes="(max-width: 639px) 100vw, (max-width: 1023px) 50vw, 30vw"
              className="h-auto w-full"
            />
          </li>
        ))}
      </ul>
    </Section>
  );
}
