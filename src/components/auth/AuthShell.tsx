import Image from "next/image";
import Link from "next/link";

type AuthShellProps = {
  /** Small mono eyebrow above the heading, e.g. "Members". */
  eyebrow: string;
  heading: string;
  subheading: string;
  children: React.ReactNode;
  /** Rendered under the card — the sign-up / sign-in cross-link. */
  footer?: React.ReactNode;
};

/**
 * Split layout shared by every auth screen: photographic panel on the left,
 * form on the right. Below 900px the photo collapses to a compact banner so
 * the form stays above the fold on a phone.
 */
export function AuthShell({
  eyebrow,
  heading,
  subheading,
  children,
  footer,
}: AuthShellProps) {
  return (
    <main className="min-h-dvh lg:grid lg:grid-cols-[1.1fr_1fr]">
      {/* Photographic panel */}
      <div className="relative isolate hidden overflow-hidden lg:block">
        <Image
          src="/images/hero.jpeg"
          alt=""
          fill
          priority
          sizes="(max-width: 1024px) 0px, 55vw"
          className="object-cover"
        />
        {/* Fixed dark scrim in both themes: this is a photo, not a themed
            surface, and light-theme text was unreadable over bright patches. */}
        <div
          aria-hidden
          className="absolute inset-0 bg-linear-to-b from-[rgb(11_11_12/0.35)] to-[rgb(11_11_12/0.94)]"
        />
        <div className="relative z-10 flex h-full flex-col justify-between p-12">
          <Link
            href="/"
            className="inline-flex w-fit items-center gap-3 rounded-full focus-visible:outline-2"
          >
            <span className="flex size-11 items-center justify-center rounded-full bg-accent">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
                <circle cx="12" cy="12" r="9" stroke="#0B0B0C" strokeWidth="2" />
                <path
                  d="M12 5 L12 12 L16 15"
                  stroke="#0B0B0C"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </svg>
            </span>
            <span className="font-display text-2xl tracking-wide text-[#EDEAE2]">
              JC MUAYTHAI
            </span>
          </Link>

          <div>
            <p className="font-mono text-xs uppercase tracking-[0.16em] text-accent">
              Muay Thai — Jersey City
            </p>
            <p className="mt-4 max-w-md font-display text-5xl leading-[0.92] tracking-wide text-[#EDEAE2]">
              UNLEASH YOUR INNER FIGHTER
            </p>
            <p className="mt-4 max-w-sm text-sm leading-relaxed text-[rgb(237_234_226/0.8)]">
              Build confidence. Improve fitness. Learn real skills. Your first
              class is free — no gear, no experience needed.
            </p>
          </div>
        </div>
      </div>

      {/* Form panel */}
      <div className="flex flex-col justify-center px-5 py-10 sm:px-10 lg:px-14">
        <div className="mx-auto w-full max-w-md">
          {/* Compact brand lockup, shown only when the photo panel is hidden */}
          <Link
            href="/"
            className="mb-10 inline-flex items-center gap-3 lg:hidden"
          >
            <span className="flex size-10 items-center justify-center rounded-full bg-accent">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
                <circle cx="12" cy="12" r="9" stroke="#0B0B0C" strokeWidth="2" />
                <path
                  d="M12 5 L12 12 L16 15"
                  stroke="#0B0B0C"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </svg>
            </span>
            <span className="font-display text-xl tracking-wide text-text">
              JC MUAYTHAI
            </span>
          </Link>

          <p className="font-mono text-[11px] uppercase tracking-[0.1em] text-text-2">
            {eyebrow}
          </p>
          <h1 className="mt-2 font-display text-4xl tracking-wide text-text sm:text-5xl">
            {heading}
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-text-2">
            {subheading}
          </p>

          <div className="mt-8">{children}</div>

          {footer ? (
            <div className="mt-8 text-sm text-text-2">{footer}</div>
          ) : null}
        </div>
      </div>
    </main>
  );
}
