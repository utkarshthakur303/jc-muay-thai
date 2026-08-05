import Link from "next/link";

import { channelHref, confirmedChannels, site } from "@/content/site";
import { totalWeeklySessions } from "@/content/schedule";

/**
 * The direct-contact panel beside the form.
 *
 * In the mockup this listed an email address, a phone number, an Instagram
 * handle and a street address — each followed by the literal word
 * "(placeholder)" on the live page. All four were invented.
 *
 * They are not rendered until the client confirms them (questionnaire
 * Q2.1–Q2.4). This is not tidiness. A published phone number sends real
 * people to a stranger's handset, and a published address sends them to
 * someone else's front door — a gym has one chance with a first-time
 * visitor, and "I called and it was the wrong number" spends it. So the
 * panel shows fewer facts rather than wrong ones, and every one it does
 * show is something we actually know: the city, and how many classes run.
 *
 * Turning a channel on is one word in content/site.ts. Nothing here needs
 * touching.
 */
export function ContactDetails() {
  return (
    <div className="card-surface card-hover flex flex-col gap-6 p-6 sm:p-8">
      <div>
        <p className="label-mono">Where</p>
        <p className="mt-1.5 text-[15px] text-text">
          {site.city}, {site.region}
        </p>
      </div>

      {confirmedChannels.map((channel) => {
        const href = channelHref(channel);
        return (
          <div key={channel.kind}>
            <p className="label-mono">{channel.label}</p>
            <p className="mt-1.5 text-[15px] text-text">
              {href ? (
                <a
                  href={href}
                  className="transition-colors hover:text-accent-strong"
                  {...(channel.kind === "instagram"
                    ? { target: "_blank", rel: "noopener noreferrer" }
                    : {})}
                >
                  {channel.value}
                </a>
              ) : (
                channel.value
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

      <div className="border-t border-divider pt-5">
        <p className="label-mono">Class times</p>
        <p className="mt-1.5 text-sm leading-relaxed text-text-2">
          {totalWeeklySessions} sessions a week, Monday to Saturday.{" "}
          <Link href="#schedule" className="text-accent-strong hover:underline">
            See the full schedule
          </Link>
          .
        </p>
      </div>
    </div>
  );
}
