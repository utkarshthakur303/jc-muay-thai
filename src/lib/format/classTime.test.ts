import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { relativeDayLabel } from "@/lib/format/classTime";

/**
 * The gym is in America/New_York and the server is in UTC, so every one of
 * these would be wrong if the label were computed in the reader's zone or
 * by adding 24 hours to an instant.
 */
const ZONE = "America/New_York";

describe("relativeDayLabel", () => {
  // 2026-08-20 is a Thursday. 18:00 in New York is 22:00 UTC.
  const now = new Date("2026-08-20T22:00:00Z");

  it("names the day the class happens at the gym", () => {
    assert.equal(relativeDayLabel("2026-08-20T23:00:00Z", ZONE, now), "Today");
    assert.equal(
      relativeDayLabel("2026-08-21T23:00:00Z", ZONE, now),
      "Tomorrow",
    );
    assert.equal(
      relativeDayLabel("2026-08-19T23:00:00Z", ZONE, now),
      "Yesterday",
    );
  });

  it("says nothing about a day it cannot name", () => {
    assert.equal(relativeDayLabel("2026-08-22T23:00:00Z", ZONE, now), null);
    assert.equal(relativeDayLabel("2026-08-18T23:00:00Z", ZONE, now), null);
  });

  it("uses the gym's calendar day, not UTC's", () => {
    // 2026-08-21T01:00Z is 9 PM on the 20th in New York — the same gym day
    // as `now`, even though UTC has already rolled over.
    assert.equal(relativeDayLabel("2026-08-21T01:00:00Z", ZONE, now), "Today");
  });

  it("holds across the spring-forward Sunday, which is 23 hours long", () => {
    // US DST begins 2026-03-08. Adding a raw 24h to Sunday evening lands
    // on Monday *evening*, which still reads as Monday — but the reverse
    // step is where the naive version breaks, so both are checked.
    const sundayEvening = new Date("2026-03-08T22:00:00Z"); // 6 PM EDT, Sun 8th
    assert.equal(
      relativeDayLabel("2026-03-07T22:00:00Z", ZONE, sundayEvening),
      "Yesterday",
    );
    assert.equal(
      relativeDayLabel("2026-03-09T22:00:00Z", ZONE, sundayEvening),
      "Tomorrow",
    );
  });

  it("holds across the fall-back Sunday, which is 25 hours long", () => {
    // US DST ends 2026-11-01.
    const sundayEvening = new Date("2026-11-01T22:00:00Z"); // 5 PM EST, Sun 1st
    assert.equal(
      relativeDayLabel("2026-10-31T22:00:00Z", ZONE, sundayEvening),
      "Yesterday",
    );
    assert.equal(
      relativeDayLabel("2026-11-02T22:00:00Z", ZONE, sundayEvening),
      "Tomorrow",
    );
  });

  it("defaults to the real clock when none is given", () => {
    // The signature gained `now` for testability; the callers still pass
    // two arguments, so the default has to keep working.
    const soon = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    assert.ok(["Today", "Tomorrow"].includes(relativeDayLabel(soon, ZONE) ?? ""));
  });
});
