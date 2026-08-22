import assert from "node:assert/strict";
import { describe, it } from "node:test";

/**
 * The comparison that decides whether a dated class still belongs to the
 * timetable — and the bug that made a single edit delete 267 classes on
 * production, 2026-08-22.
 *
 * Postgres and JavaScript spell the same instant differently. Nothing in
 * the type system says so, both are strings, and both look correct in a
 * log line. The only thing that catches it is comparing them.
 *
 * Kept as a standalone test because the function it guards lives in a
 * `server-only` module the node runner cannot import; this is the rule
 * itself, asserted directly.
 */

/** Mirrors `occurrenceKey` in lib/admin/timetable.ts. */
function occurrenceKey(slug: string, startsAt: string): string {
  const instant = Date.parse(startsAt);
  return `${slug}@${Number.isNaN(instant) ? startsAt : instant}`;
}

describe("occurrenceKey", () => {
  it("treats the two spellings of one instant as the same class", () => {
    // Left: how PostgREST returns a timestamptz.
    // Right: how Date.toISOString() writes the identical moment.
    const fromDatabase = occurrenceKey("sat-1300-kids", "2026-10-10T17:00:00+00:00");
    const fromGenerator = occurrenceKey("sat-1300-kids", "2026-10-10T17:00:00.000Z");

    assert.equal(fromDatabase, fromGenerator);

    // The naive version, for the record: these are NOT equal as strings,
    // which is exactly how every class on the calendar came to look
    // orphaned at once.
    assert.notEqual(
      "2026-10-10T17:00:00+00:00",
      "2026-10-10T17:00:00.000Z",
    );
  });

  it("survives a non-UTC offset for the same instant", () => {
    assert.equal(
      occurrenceKey("mon-0900-beginner", "2026-10-10T17:00:00+00:00"),
      occurrenceKey("mon-0900-beginner", "2026-10-10T13:00:00-04:00"),
    );
  });

  it("keeps different instants apart", () => {
    assert.notEqual(
      occurrenceKey("sat-1300-kids", "2026-10-10T17:00:00Z"),
      occurrenceKey("sat-1300-kids", "2026-10-10T18:00:00Z"),
    );
  });

  it("keeps different sessions at the same instant apart", () => {
    assert.notEqual(
      occurrenceKey("sat-1300-kids", "2026-10-10T17:00:00Z"),
      occurrenceKey("sat-1300-beginner", "2026-10-10T17:00:00Z"),
    );
  });

  it("falls back to the raw string rather than collapsing bad input", () => {
    // Two unparseable values must not both become "NaN" and compare equal.
    assert.notEqual(
      occurrenceKey("x", "not a date"),
      occurrenceKey("x", "also not a date"),
    );
  });
});
