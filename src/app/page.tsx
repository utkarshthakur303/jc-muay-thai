import { ClassesSection } from "@/components/classes/ClassesSection";
import { ContactSection } from "@/components/contact/ContactSection";
import { GallerySection } from "@/components/gallery/GallerySection";
import { HomeSection } from "@/components/home/HomeSection";
import { ScheduleSection } from "@/components/schedule/ScheduleSection";
import { SiteChrome } from "@/components/layout/SiteChrome";
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
 * ────────────────────────────────────────────────────────────────────
 */
export default async function HomePage() {
  const timetable = await getTimetable();

  return (
    <SiteChrome>
      <HomeSection timetable={timetable} />
      <ClassesSection timetable={timetable} />
      <ScheduleSection timetable={timetable} />
      <GallerySection />
      <ContactSection timetable={timetable} />
    </SiteChrome>
  );
}
