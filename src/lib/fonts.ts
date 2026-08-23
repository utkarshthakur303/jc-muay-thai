import { Anton, IBM_Plex_Mono, Manrope, Michroma } from "next/font/google";

/**
 * Single source of truth for typefaces.
 *
 * To change a typeface site-wide, change it here and nowhere else. Each
 * loader publishes a CSS variable named after the *role* it fills, not the
 * family that currently fills it — so swapping the display face is a
 * one-line edit, with no change to globals.css or to any component. That
 * claim has now been tested: this file went from Bebas Neue to Anton and
 * nothing else in the tree moved.
 *
 * next/font (rather than a <link> to Google Fonts) is deliberate:
 *   - the font files are self-hosted from our own origin at build time, so
 *     there is no third-party request, no extra DNS/TLS handshake, and no
 *     visitor IP handed to Google (a GDPR problem for a public site);
 *   - the CSS is generated with a matching size-adjust fallback, which
 *     removes the layout shift that `display: swap` otherwise causes.
 */

/**
 * Anton, not Bebas Neue.
 *
 * The brief was Impact, or Grokster, or something with that weight. Impact
 * itself cannot be used: it is a system font on Windows and macOS and
 * absent on most Android devices and every Linux box, so half the audience
 * would silently get the fallback — and it has no webfont licence to ship.
 * Grokster is not a webfont at all.
 *
 * Anton is the free face Impact substitutes are usually built from: same
 * condensed grotesque skeleton, same near-black weight, drawn as a webfont
 * with a full Latin set and proper hinting. It stays in the `Impact`
 * fallback stack below it, so the shape barely shifts if the font fails.
 *
 * Against Bebas Neue this is a real change, not a swap of near-identicals:
 * Bebas is a light-to-medium all-caps face with open counters, Anton is
 * heavy with tight ones. It hits harder, which is the point, and it also
 * has true lowercase where Bebas had none — every heading on this site is
 * already uppercased at the call site, so that changes nothing today, but
 * a heading added later will now render as it was typed.
 */
const display = Anton({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-display-src",
  display: "swap",
  // Rendered at large sizes where the metric mismatch with the fallback is
  // most visible, so let next/font compute the adjustment.
  adjustFontFallback: true,
});

/**
 * Michroma, standing in for Good Times.
 *
 * The client asked for Good Times across the hero. It cannot ship:
 * Typodermic sell it as a desktop licence, it is not on Google Fonts,
 * and it carries no webfont embedding rights — so putting it in a
 * @font-face would be redistributing somebody's commercial typeface from
 * our own origin. They then asked for the closest free substitute.
 *
 * Michroma is that. It is the same idea drawn by somebody else: wide,
 * square-shouldered, geometric, monoline, built for uppercase — the
 * 1970s American car-badge shape Good Times is itself derived from. The
 * proportions are the part that carries; a reader who knows Good Times
 * sees the same wide square wordmark.
 *
 * WHERE IT DIFFERS, SO NOBODY IS SURPRISED
 *
 * Weight. Michroma ships one, roughly regular. Good Times is usually set
 * bold, and Anton — the face this replaces in the hero — is effectively
 * black. The hero therefore reads lighter and wider than it did, which
 * is a real change in the site's voice and not a rounding error.
 *
 * If more punch is wanted, Orbitron is the one-line swap: the same wide
 * square genre with weights to 900, at the cost of more overtly sci-fi
 * letterforms. That change is this line and nothing else, which is the
 * whole point of this file.
 *
 * Scoped to the hero on purpose. Every other heading on the site stays
 * Anton, so this is a deliberate accent on the first screen rather than
 * a second display face competing with the first everywhere.
 */
const hero = Michroma({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-hero-src",
  display: "swap",
  // Set very large over a photograph, where a metric mismatch with the
  // fallback is at its most visible. Let next/font compute the adjust.
  adjustFontFallback: true,
});

const body = Manrope({
  weight: ["400", "500", "600", "700"],
  subsets: ["latin"],
  variable: "--font-body-src",
  display: "swap",
});

const mono = IBM_Plex_Mono({
  weight: ["400", "500", "600"],
  subsets: ["latin"],
  variable: "--font-mono-src",
  display: "swap",
});

/** Applied once, to <html>. Every font variable enters the cascade here. */
export const fontVariables = `${display.variable} ${hero.variable} ${body.variable} ${mono.variable}`;
