import { Bebas_Neue, IBM_Plex_Mono, Manrope } from "next/font/google";

/**
 * Single source of truth for typefaces.
 *
 * To change a typeface site-wide, change it here and nowhere else. Each
 * loader publishes a CSS variable named after the *role* it fills, not the
 * family that currently fills it — so swapping Bebas Neue for another
 * display face is a one-line edit, with no change to globals.css or to any
 * component.
 *
 * next/font (rather than a <link> to Google Fonts) is deliberate:
 *   - the font files are self-hosted from our own origin at build time, so
 *     there is no third-party request, no extra DNS/TLS handshake, and no
 *     visitor IP handed to Google (a GDPR problem for a public site);
 *   - the CSS is generated with a matching size-adjust fallback, which
 *     removes the layout shift that `display: swap` otherwise causes.
 */

const display = Bebas_Neue({
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
