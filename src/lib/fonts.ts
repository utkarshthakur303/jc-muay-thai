import { Anton, IBM_Plex_Mono, Manrope } from "next/font/google";

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
export const fontVariables = `${display.variable} ${body.variable} ${mono.variable}`;
