import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  PLAN_BOOKING_MAX,
  planBookingTarget,
  releaseForPlan,
  selectForPlan,
  type PlanCandidate,
} from "@/lib/plans/planBookings";

/**
 * These rules spend a real gym's capacity.
 *
 * Every case below is something that would be felt by somebody: a member
 * booked back into a class they cancelled, a beginner left on the
 * Beginners roster a month after moving up, a class oversold, a member on
 * a two-week trial put into ten sessions they never agreed to.
 */

/** Terse builder so a case reads as the situation it describes. */
const candidate = (
  occurrenceId: string,
  overrides: Partial<PlanCandidate> = {},
): PlanCandidate => ({
  occurrenceId,
  capacity: 16,
  bookedCount: 0,
  existingRows: 0,
  ...overrides,
});

describe("planBookingTarget", () => {
  it("books the level the member chose", () => {
    assert.equal(planBookingTarget("intermediate", "monthly"), "intermediate");
    assert.equal(planBookingTarget("advanced", "contract"), "advanced");
    assert.equal(planBookingTarget("kids", "annual"), "kids");
  });

  it("books nothing for a member who declined to choose", () => {
    assert.equal(planBookingTarget(null, "monthly"), null);
    assert.equal(planBookingTarget(null, null), null);
  });

  it("books nothing on the two-week trial, whatever the class", () => {
    // A trial is somebody trying the gym out. Filling their week says
    // they have adopted its schedule, which is the opposite of what a
    // trial is.
    assert.equal(planBookingTarget("beginner", "trial"), null);
    assert.equal(planBookingTarget("advanced", "trial"), null);
  });

  it("books when no term was given at all", () => {
    // The term is optional — people settle it at the desk. Only the
    // trial suppresses booking, and its absence is not a trial.
    assert.equal(planBookingTarget("beginner", null), "beginner");
  });
});

describe("releaseForPlan", () => {
  const held = [
    { occurrenceId: "a", level: "beginner" as const },
    { occurrenceId: "b", level: "beginner" as const },
    { occurrenceId: "c", level: "advanced" as const },
  ];

  it("releases everything at a level the member has left", () => {
    assert.deepEqual(releaseForPlan(held, "advanced"), ["a", "b"]);
  });

  it("releases everything when the plan is cleared", () => {
    assert.deepEqual(releaseForPlan(held, null), ["a", "b", "c"]);
  });

  it("releases nothing when the level has not moved", () => {
    // Switching Monthly to Yearly must not churn a member's whole week.
    // The term moved; the class did not.
    assert.deepEqual(releaseForPlan([held[0]!, held[1]!], "beginner"), []);
  });

  it("holds nothing when there is nothing held", () => {
    assert.deepEqual(releaseForPlan([], "beginner"), []);
  });
});

describe("selectForPlan", () => {
  it("books the free classes it is offered, in order", () => {
    const { book, full } = selectForPlan([
      candidate("a"),
      candidate("b"),
      candidate("c"),
    ]);
    assert.deepEqual(book, ["a", "b", "c"]);
    assert.equal(full, 0);
  });

  it("never re-books a class the member cancelled", () => {
    // THE case this whole feature lives or dies on. Bookings are never
    // deleted, so a cancelled class still has a row — and a row is the
    // only honest record of "they already said no to this one".
    const { book } = selectForPlan([
      candidate("kept", { existingRows: 1 }),
      candidate("fresh"),
    ]);
    assert.deepEqual(book, ["fresh"]);
  });

  it("never books a class the member already holds", () => {
    const { book } = selectForPlan([candidate("mine", { existingRows: 1 })]);
    assert.deepEqual(book, []);
  });

  it("skips a full class and counts it rather than attempting it", () => {
    const { book, full } = selectForPlan([
      candidate("packed", { capacity: 16, bookedCount: 16 }),
      candidate("room", { capacity: 16, bookedCount: 15 }),
    ]);
    assert.deepEqual(book, ["room"]);
    assert.equal(full, 1);
  });

  it("treats an over-full class as full rather than as a negative", () => {
    // The database makes this unrepresentable. The comparison is written
    // so that a row which somehow got there still reads as "no room".
    const { book, full } = selectForPlan([
      candidate("impossible", { capacity: 16, bookedCount: 17 }),
    ]);
    assert.deepEqual(book, []);
    assert.equal(full, 1);
  });

  it("treats a zero-capacity class as full", () => {
    const { book, full } = selectForPlan([
      candidate("closed", { capacity: 0, bookedCount: 0 }),
    ]);
    assert.deepEqual(book, []);
    assert.equal(full, 1);
  });

  it("stops at the cap, however long the timetable gets", () => {
    // The owner can edit the timetable from the admin panel now. Adding
    // a morning session to every day must not quietly turn this into a
    // bigger number for every member on that level.
    const many = Array.from({ length: 40 }, (_, i) => candidate(`c${i}`));
    const { book } = selectForPlan(many);
    assert.equal(book.length, PLAN_BOOKING_MAX);
    assert.equal(book[0], "c0");
  });

  it("counts a full class it never reached as neither booked nor full", () => {
    // The cap stops the loop. Classes past it were not examined, so
    // claiming they were full would be inventing a reason.
    const { book, full } = selectForPlan(
      [
        candidate("a"),
        candidate("b"),
        candidate("beyond", { capacity: 16, bookedCount: 16 }),
      ],
      2,
    );
    assert.deepEqual(book, ["a", "b"]);
    assert.equal(full, 0);
  });

  it("books nothing when asked for nothing", () => {
    assert.deepEqual(selectForPlan([], 0).book, []);
    assert.deepEqual(selectForPlan([candidate("a")], 0).book, []);
  });

  it("takes the earliest classes, because the caller ordered them", () => {
    // selectForPlan does not sort, deliberately: the query orders by
    // starts_at in Postgres, and re-sorting a page here would sort the
    // wrong page.
    const { book } = selectForPlan(
      [candidate("mon"), candidate("tue"), candidate("wed")],
      2,
    );
    assert.deepEqual(book, ["mon", "tue"]);
  });
});
