import { ActiveSectionProvider } from "@/components/layout/ActiveSection";
import { MobileNav } from "@/components/layout/MobileNav";
import { SidebarRail } from "@/components/layout/SidebarRail";
import { TopBar } from "@/components/layout/TopBar";
import { sectionIds, site } from "@/content/site";

/**
 * Page frame: fixed navigation on three surfaces, plus the scrolling
 * content column they sit over.
 *
 * A server component, and nothing inside it reads the visitor's session.
 * That is what lets the home page be statically generated and served from
 * the CDN edge — no Supabase round-trip in front of a marketing page, and
 * throughput that does not depend on the auth service being up. Only the
 * two nav surfaces that track scroll position ship JavaScript.
 *
 * The left padding at lg matches the rail's 136px footprint (24px offset +
 * 88px rail + 24px gutter). It is on a wrapper rather than on <main> so
 * that <main> still centres its own max-width inside the remaining space —
 * with the padding on <main> itself, content on a wide screen would hug
 * the rail instead of centring.
 */
export function SiteChrome({ children }: { children: React.ReactNode }) {
  return (
    <ActiveSectionProvider sectionIds={sectionIds}>
      {/*
        Removed at the client's request: a "Skip to content" link used to
        sit here as the first focusable element.

        Recording the consequence rather than the change, since it is not
        visible on screen. It was invisible until a keyboard user pressed
        Tab, and it satisfied WCAG 2.4.1 Bypass Blocks (Level A). Without
        it, anyone navigating by keyboard or screen reader now tabs
        through the rail's five section links and the booking button
        before reaching the page content, on every visit.

        <main id="main"> keeps its id, so restoring this is one anchor.
      */}
      <SidebarRail />
      <TopBar />
      <MobileNav />

      <div className="lg:pl-(--layout-rail-offset)">
        <main id="main" className="page-shell pt-24 pb-32 lg:pt-30 lg:pb-20">
          {children}
        </main>

        <footer className="page-shell pb-32 lg:pb-12">
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-7">
            <span className="font-display text-xl tracking-wide text-text">
              {site.name.toUpperCase()}
            </span>
            {/*
              No year. The page is statically generated, so `new Date()`
              would freeze at build time and quietly go stale — a footer
              reading "© 2026" two years on looks abandoned. A year is not
              required for copyright to subsist, so the honest option is to
              omit what we cannot keep current without a rebuild.
            */}
            <span className="font-mono text-xs text-text-2">
              © {site.name}. {site.city}, {site.region}.
            </span>
          </div>
        </footer>
      </div>
    </ActiveSectionProvider>
  );
}
