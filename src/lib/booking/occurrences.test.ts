import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { generateOccurrences } from "./occurrences.ts";
import type { Session } from "../../content/schedule.ts";

const TZ = "America/New_York";

const session = (
  day: Session["day"],
  level: Session["level"],
  start: string,
  end: string,
): Session => ({ day, level, start, end });

const capacityFor = () => 16;

describe("generateOccurrences", () => {
  it("skips Sunday, because the gym does not open", () => {
    // 9 August 2026 is a Sunday.
    const drafts = generateOccurrences([session("mon", "beginner", "09:00", "10:00")], {
      from: new Date("2026-08-09T12:00:00Z"),
      days: 1,
      timeZone: TZ,
      capacityFor,
    });
    assert.equal(drafts.length, 0);
  });

  it("emits one occurrence per matching weekday in the window", () => {
    // Mon 10 Aug through Sun 23 Aug 2026 — two Mondays.
    const drafts = generateOccurrences([session("mon", "beginner", "09:00", "10:00")], {
      from: new Date("2026-08-10T12:00:00Z"),
      days: 14,
      timeZone: TZ,
      capacityFor,
    });
    assert.deepEqual(
      drafts.map((d) => d.starts_at),
      ["2026-08-10T13:00:00.000Z", "2026-08-17T13:00:00.000Z"],
    );
  });

  it("holds the gym's wall-clock time across a daylight saving change", () => {
    // A fortnight straddling 1 November 2026. Both Sundays-to-Monday
    // classes must read 09:00 locally, which means different UTC hours.
    const drafts = generateOccurrences([session("mon", "beginner", "09:00", "10:00")], {
      from: new Date("2026-10-26T12:00:00Z"),
      days: 14,
      timeZone: TZ,
      capacityFor,
    });
    assert.deepEqual(
      drafts.map((d) => d.starts_at),
      [
        "2026-10-26T13:00:00.000Z", // EDT
        "2026-11-02T14:00:00.000Z", // EST — one hour later in UTC, same 9am locally
      ],
    );
  });

  it("anchors the window to the gym's date, not the server's", () => {
    // 01:00Z Tuesday is still Monday evening in Jersey City, so Monday's
    // classes are still in range.
    const drafts = generateOccurrences([session("mon", "beginner", "09:00", "10:00")], {
      from: new Date("2026-08-11T01:00:00Z"),
      days: 1,
      timeZone: TZ,
      capacityFor,
    });
    assert.equal(drafts.length, 1);
    assert.equal(drafts[0]?.starts_at, "2026-08-10T13:00:00.000Z");
  });

  it("produces stable slugs that survive regeneration", () => {
    const options = {
      from: new Date("2026-08-10T12:00:00Z"),
      days: 7,
      timeZone: TZ,
      capacityFor,
    };
    const sessions = [session("tue", "advanced", "19:00", "20:30")];

    assert.deepEqual(
      generateOccurrences(sessions, options),
      generateOccurrences(sessions, options),
    );
    assert.equal(generateOccurrences(sessions, options)[0]?.session_slug, "tue-1900-advanced");
  });

  it("keeps end after start", () => {
    const drafts = generateOccurrences([session("sat", "kids", "13:00", "13:45")], {
      from: new Date("2026-08-10T12:00:00Z"),
      days: 7,
      timeZone: TZ,
      capacityFor,
    });
    for (const draft of drafts) {
      assert.ok(new Date(draft.ends_at) > new Date(draft.starts_at));
    }
  });
});
