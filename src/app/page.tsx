import { ClassesSection } from "@/components/classes/ClassesSection";
import { ContactSection } from "@/components/contact/ContactSection";
import { GallerySection } from "@/components/gallery/GallerySection";
import { HomeSection } from "@/components/home/HomeSection";
import { ScheduleSection } from "@/components/schedule/ScheduleSection";
import { SiteChrome } from "@/components/layout/SiteChrome";
import { navSections } from "@/content/site";
import { getSiteImages } from "@/lib/images/queries";
import { getTimetable } from "@/lib/schedule/queries";

/**
 * The public home page.
 *
 * Statically generated. Nothing on it reads cookies or the visitor's
 * session, so Next.js prerenders it at build time and Vercel serves it
 * from the edge cache — no Node process, no Supabase round-trip, and no
 * per-visitor work in front of the marketing page. That is what lets it
 * absorb a traffic spike, and it is why the calls to action point at fixed
 * destinations that the proxy redirects for signed-in members, rather than
 * branching on the session here.
 *
 * The contact form does not change that. A server action is its own POST
 * endpoint: the page stays HTML on a CDN, and the only request that ever
 * reaches a server is an actual submission.
 *
 * Section order is the order in navSections. Both are in document order
 * and the active-section observer watches exactly these ids, so the rail
 * cannot advertise a section that is not here.
 *
 * ── THE TIMETABLE IS FETCHED HERE, ONCE ─────────────────────────────
 * Four of the five sections need it — the weekly chart, the class cards,
 * the schedule grid and the "sessions a week" line under Contact — and
 * before 2026-08-22 each imported it from a module constant, which is
 * why they could never disagree. Now that the owner can edit it, one
 * fetch at the top and props downward is what preserves that property:
 * every section on a given render is looking at the same timetable.
 *
 * This does NOT cost the page its static prerender. `getTimetable` goes
 * to PostgREST with the publishable key over plain fetch and never
 * touches `cookies()` — see the header of lib/schedule/queries.ts for
 * why that distinction is load-bearing. Next caches the response under
 * the `timetable` tag, so this page is built once and rebuilt only when
 * the owner actually changes something.
 *
 * If the build output ever shows this route as `ƒ (Dynamic)`, something
 * in this tree started reading the session. That is a regression, not a
 * detail.
 *
 * ── THE PHOTOGRAPHS ARE FETCHED THE SAME WAY, AND IN PARALLEL ───────
 * Added 2026-08-23, when the pictures moved out of `public/images` and
 * into the database so the gym can change its own. Same constraints,
 * same solution: a cookie-free tagged fetch, once, with the result
 * passed down as props.
 *
 * `Promise.all` rather than two awaits — they do not depend on each
 * other, and sequencing them would put one round trip in front of the
 * other for no reason on every cold build.
 * ────────────────────────────────────────────────────────────────────
 */
export default async function HomePage() {
  const [timetable, images] = await Promise.all([
    getTimetable(),
    getSiteImages(),
  ]);

  /**
   * The nav lists the sections that are actually rendered below.
   *
   * GallerySection returns null when the gym has no photographs, so the
   * Gallery item would otherwise be a link scrolling to an id that does
   * not exist — and the active-section observer would be watching for an
   * element that never arrives.
   */
  const sections = navSections.filter(
    (section) => section.id !== "gallery" || images.gallery.length > 0,
  );

  return (
    <SiteChrome sections={sections}>
      <HomeSection timetable={timetable} images={images} />
      <ClassesSection timetable={timetable} images={images} />
      <ScheduleSection timetable={timetable} />
      <GallerySection photos={images.gallery} />
      <ContactSection timetable={timetable} />
    </SiteChrome>
  );
}
