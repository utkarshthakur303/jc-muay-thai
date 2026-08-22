import Link from "next/link";

import {
  channelHref,
  confirmedChannels,
  OPENING_DAY_LABELS,
  openingHours,
  site,
} from "@/content/site";
import { totalWeeklySessions } from "@/content/schedule";
import type { TimetableEntry } from "@/lib/schedule/queries";
import { formatRangeCompact, formatTime } from "@/lib/format/time";

/**
 * The direct-contact panel beside the form.
 *
 * In the mockup this listed an email address, a phone number, an Instagram
 * handle and a street address — each followed by the literal word
 * "(placeholder)" on the live page. All four were invented, all four were
 * therefore withheld, and for three months this site gave a visitor no way
 * to phone the gym.
 *
 * All four are real as of 2026-08-18, taken from the business's own live
 * site. The mechanism did not change: `confirmedChannels` is still the
 * gate, so anything we stop being sure about goes back to being withheld
 * by editing one word in content/site.ts, and nothing here needs touching.
 *
 * The full street address replaces the bare "Jersey City, NJ" that stood
 * in for it — as plain text, not a map link, at the client's instruction.
 */
export function ContactDetails({
  timetable,
}: {
  timetable: readonly TimetableEntry[];
}) {
  return (
    <div className="card-surface card-hover flex flex-col gap-6 p-6 sm:p-8">
      {/*
        Only shown when the address is being withheld. With it published
        below, a "Where: Jersey City, NJ" above the full street address is
        the same fact twice, the vaguer one first.
      */}
      {confirmedChannels.some((channel) => channel.kind === "address") ? null : (
        <div>
          <p className="label-mono">Where</p>
          <p className="mt-1.5 text-[15px] text-text">
            {site.city}, {site.region}
          </p>
        </div>
      )}

      {confirmedChannels.map((channel) => {
        const href = channelHref(channel);
        return (
          <div key={channel.kind}>
            <p className="label-mono">{channel.label}</p>
            <p className="mt-0.5 text-[15px] text-text">
              {href ? (
                /*
                  `inline-flex min-h-11`, not a bare inline anchor.

                  These are standalone links, one per row, not links
                  inside a sentence — so WCAG 2.5.8's inline exception
                  does not cover them, and as plain text they measured
                  21px tall. The phone number in particular is the single
                  most likely thing anyone taps on this page, and they
                  will be doing it one-handed on a phone.
                */
                <a
                  href={href}
                  className="inline-flex min-h-11 items-center transition-colors hover:text-accent-strong"
                  {...(channel.kind === "instagram"
                    ? { target: "_blank", rel: "noopener noreferrer" }
                    : {})}
                >
                  {channel.value}
                </a>
              ) : (
                <span className="inline-flex min-h-11 items-center">
                  {channel.value}
                </span>
              )}
            </p>
          </div>
        );
      })}

      {confirmedChannels.length === 0 ? (
        <p className="text-sm leading-relaxed text-text-2">
          The form is the way to reach us at the moment. Direct phone and
          email will be listed here shortly.
        </p>
      ) : null}

      {/*
        The hours in full, repeated from the schedule section on purpose.
        Somebody who scrolled to Contact to ring the gym should not have
        to scroll back up to find out whether anyone is there — and the
        two copies cannot disagree, because both read `openingHours`.
      */}
      <div className="border-t border-divider pt-5">
        <p className="label-mono">Open</p>
        <dl className="mt-2 flex flex-col gap-1.5 font-mono text-xs">
          {openingHours.map((entry) => (
            <div key={entry.day} className="flex justify-between gap-4">
              <dt className="text-text-2">
                <span aria-hidden>{OPENING_DAY_LABELS[entry.day].short}</span>
                <span className="sr-only">
                  {OPENING_DAY_LABELS[entry.day].long}
                </span>
              </dt>
              {entry.opens !== null && entry.closes !== null ? (
                <dd className="whitespace-nowrap text-text">
                  <span aria-hidden>
                    {formatRangeCompact(entry.opens, entry.closes)}
                  </span>
                  <span className="sr-only">
                    {formatTime(entry.opens)} to {formatTime(entry.closes)}
                  </span>
                </dd>
              ) : (
                <dd className="text-text-3">Closed</dd>
              )}
            </div>
          ))}
        </dl>
      </div>

      <div className="border-t border-divider pt-5">
        <p className="label-mono">Class times</p>
        <p className="mt-1.5 text-sm leading-relaxed text-text-2">
          {totalWeeklySessions(timetable)} sessions a week, Monday to Saturday.{" "}
          <Link href="#schedule" className="text-accent-strong hover:underline">
            See the full schedule
          </Link>
          .
        </p>
      </div>
    </div>
  );
}
