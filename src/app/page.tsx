import { ClassesSection } from "@/components/classes/ClassesSection";
import { ContactSection } from "@/components/contact/ContactSection";
import { GallerySection } from "@/components/gallery/GallerySection";
import { HomeSection } from "@/components/home/HomeSection";
import { ScheduleSection } from "@/components/schedule/ScheduleSection";
import { SiteChrome } from "@/components/layout/SiteChrome";

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
 */
export default function HomePage() {
  return (
    <SiteChrome>
      <HomeSection />
      <ClassesSection />
      <ScheduleSection />
      <GallerySection />
      <ContactSection />
    </SiteChrome>
  );
}
