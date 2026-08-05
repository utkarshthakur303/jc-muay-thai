import type { Metadata, Viewport } from "next";

import { fontVariables } from "@/lib/fonts";

import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "JC Muaythai — Authentic Muay Thai in Jersey City",
    template: "%s · JC Muaythai",
  },
  description:
    "Train authentic Muay Thai in Jersey City. Beginner to advanced classes, twice daily. Your first class is free.",
  robots: { index: true, follow: true },
};

/**
 * Tints the browser and OS chrome around the page.
 *
 * The only place in the codebase where a colour is repeated rather than
 * tokenised, and unavoidably so: this becomes a <meta> tag, and meta
 * content cannot read a CSS variable. Both values must mirror `--bg` for
 * the matching theme in globals.css — if one changes there, change it
 * here.
 */
export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#0B0B0C" },
    { media: "(prefers-color-scheme: light)", color: "#F6F1EA" },
  ],
};

/**
 * Applies the stored theme before first paint. Without this the page
 * renders in the default theme and then snaps to the chosen one — a
 * visible flash on every navigation.
 */
const THEME_SCRIPT = `
(function(){
  try {
    var stored = localStorage.getItem('jc-theme');
    var prefersLight = window.matchMedia('(prefers-color-scheme: light)').matches;
    var theme = stored || (prefersLight ? 'light' : 'dark');
    document.documentElement.setAttribute('data-theme', theme);
  } catch (e) {
    document.documentElement.setAttribute('data-theme', 'dark');
  }
})();
`;

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      data-theme="dark"
      suppressHydrationWarning
      className={fontVariables}
    >
      <head>
        {/*
          suppressHydrationWarning is required on the script element itself:
          the flag does not cascade from <html> to descendants.

          Browser extensions commonly rewrite or inject <script> tags in
          <head> before React hydrates, which otherwise surfaces as a
          hydration mismatch that looks like an application bug but is not
          one. Nothing here is hydration-sensitive — the script runs once,
          before paint, purely for its side effect on <html data-theme>.
        */}
        <script
          suppressHydrationWarning
          dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
