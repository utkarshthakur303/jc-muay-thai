/**
 * Gallery photographs.
 *
 * The mockup's gallery listed eight images, but the site only has eight
 * images in total — five of which are already on screen as the hero, the
 * promo tile and the three class cards. Repeating the hero photograph a
 * few hundred pixels below the hero does not read as a gallery; it reads
 * as a bug. So this is the three photographs that are not used anywhere
 * else, and the section is honestly small rather than dishonestly full.
 *
 * All eight are stock. Questionnaire Q5.6 asks the client for real photos
 * of the gym, and Q5.8 for the model releases that publishing identifiable
 * students requires. When those land they are appended here and the layout
 * absorbs them — nothing below is sized for exactly three items.
 *
 * `width`/`height` are the real pixel dimensions of the files on disk,
 * measured rather than guessed. next/image needs them to reserve the right
 * box before the bytes arrive; a wrong ratio here is a layout shift.
 */

export type GalleryImage = {
  readonly src: string;
  readonly alt: string;
  readonly width: number;
  readonly height: number;
};

export const galleryImages: readonly GalleryImage[] = [
  {
    src: "/images/gloves.jpeg",
    alt: "Worn Muay Thai gloves and wraps racked at the side of the mat",
    width: 2560,
    height: 1706,
  },
  {
    src: "/images/shadow.jpeg",
    alt: "A fighter working through shadow boxing rounds alone in the gym",
    width: 2560,
    height: 1828,
  },
  {
    src: "/images/silhouette.jpeg",
    alt: "A student throwing a roundhouse kick, lit from behind",
    width: 2560,
    height: 1706,
  },
];
