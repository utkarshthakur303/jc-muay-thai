import Image from "next/image";

import { formatDurationRange } from "@/lib/format/time";
import type { ClassLevel } from "@/content/classes";

/**
 * One level: what it is, how long it runs, how often.
 *
 * These cards used to carry a full day-by-day timetable as well. That was
 * the right call when Classes was the last section on the page — the two
 * questions a prospective student has are "what is it" and "when is it",
 * and only one of them was being answered. The Schedule section answers
 * the other one properly now, so repeating six days of times on three
 * cards directly above it is the same fact stated twice on one screen.
 *
 * The duration and the weekly count stay. They are not in the schedule
 * grid — that one is organised by day, and "how long is an Advanced class"
 * is a question about the level, which you would otherwise have to answer
 * by reading six cards and subtracting.
 *
 * Both are still derived from schedule.ts, so a card cannot claim a run
 * time the timetable does not support.
 */
export function ClassCard({ level }: { level: ClassLevel }) {
  // No min-height. It used to be 420px, which was right when the card also
  // carried a six-row timetable; with that gone the card kept the height
  // and grew a dead band of empty photograph under the text. The grid
  // equalises the three cards against each other anyway, so the tallest
  // description sets the height and nothing has to guess it.
  return (
    <li className="card-photo card-hover photo-reveal copy-on-photo flex flex-col bg-card">
      {/*
        Resting and hovered opacity both live in the `photo-reveal`
        utility rather than here — see globals.css. They are one decision
        (how far the picture comes forward), and splitting them across two
        files is how the hovered state ends up brighter than the copy on
        top of it can survive.
      */}
      <Image
        src={level.image}
        alt={level.imageAlt}
        fill
        sizes="(max-width: 1023px) 100vw, 33vw"
        className="-z-10 object-cover"
      />
      <div aria-hidden className="scrim-card absolute inset-0 -z-10" />

      <div className="flex flex-1 flex-col p-7 sm:p-8">
        <p aria-hidden className="font-mono text-[13px] tracking-widest text-accent-strong">
          {level.number}
        </p>

        <h3 className="mt-2 font-display text-3xl text-text">{level.title}</h3>

        <p className="mt-3.5 flex flex-wrap gap-x-3 gap-y-1 font-mono text-[11px] tracking-[0.06em] text-text-2 uppercase">
          <span>{formatDurationRange(level.duration.min, level.duration.max)}</span>
          <span aria-hidden className="text-text-3">
            ·
          </span>
          <span>
            {level.sessionsPerWeek}{" "}
            {level.sessionsPerWeek === 1 ? "session" : "sessions"} a week
          </span>
        </p>

        <p className="mt-4 flex-1 text-sm leading-relaxed text-text-2">
          {level.description}
        </p>
      </div>
    </li>
  );
}
