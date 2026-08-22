/**
 * Gallery photographs — THE FALLBACK, not the live list.
 *
 * ── READ THIS BEFORE EDITING (2026-08-23) ───────────────────────────
 * These five stopped being what the site renders when the photographs
 * moved into the `site_images` table so the gym could change its own.
 * The home page reads `getSiteImages()`; this array is what it falls
 * back to when that table is missing or unreachable — which is a real
 * state, because migrations here are applied by hand and the code goes
 * live first.
 *
 * So it is deliberately the exact set that was on the site the day
 * before, and it should be left that way: its whole job is to make a
 * failed read look like the previous version of the site rather than a
 * blank section. Adding a photograph HERE puts it nowhere. Add it in the
 * panel.
 * ────────────────────────────────────────────────────────────────────
 *
 * The mockup's gallery listed eight images, but the site only had eight
 * images in total — five of which are already on screen as the hero, the
 * promo tile and the class cards. Repeating the hero photograph a few
 * hundred pixels below the hero does not read as a gallery; it reads as a
 * bug. So this is the photographs that are not used anywhere else, and
 * the section is honestly small rather than dishonestly full.
 *
 * ── TWO OF THESE ARE REAL (2026-08-18) ──────────────────────────────
 * `gym-class` and `gym-pads` are the actual gym: its mat, its bags, its
 * students. They come from the gym's own live site, where the business
 * has already published them itself — which is what settles the model
 * release question Q5.8 raises for the group shot. We are not making a
 * new decision about identifiable people; we are carrying across one the
 * gym already made about its own members.
 *
 * They are listed FIRST, deliberately. Given a real photograph of the
 * room and a stock photograph of a generic fighter, the real one is worth
 * more to somebody deciding whether to walk in — it is the only thing on
 * the page that shows what the place actually looks like.
 *
 * `gym-pads` arrived letterboxed, as a phone screenshot with black bars
 * top and bottom. Cropped to its content rather than shipped as-is: the
 * bars would have rendered as dead space inside a rounded card and read
 * as a broken image.
 *
 * The remaining three are stock, and still are. Questionnaire Q5.6 asks
 * the client for more real photographs; when they land they are appended
 * here and the layout absorbs them — nothing below is sized for exactly
 * five items.
 * ────────────────────────────────────────────────────────────────────
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
    src: "/images/gym-class.jpeg",
    alt: "A class of ten students gathered on the mat at the end of a session, in gloves, shin guards and Thai shorts, with heavy bags hanging along the wall behind them",
    width: 1440,
    height: 1080,
  },
  {
    src: "/images/gym-pads.jpeg",
    alt: "Two students working pads on the mat, one throwing a high kick while their partner holds",
    width: 499,
    height: 974,
  },
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
