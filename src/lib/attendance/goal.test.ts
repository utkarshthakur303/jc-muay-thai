import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  GOAL_MAX,
  GOAL_MIN,
  daysToGo,
  goalProgress,
  nextMilestone,
  parseGoal,
  streakTarget,
  suggestedGoal,
} from "./goal.ts";

/**
 * The goal rules.
 *
 * The field is a text input on a public API — a member holds the
 * publishable key and can POST whatever they like. Everything refused
 * here is refused again by `member_goals_range` in the database; these
 * tests are what stop the two drifting apart.
 */

describe("parseGoal", () => {
  it("accepts a plain count of days", () => {
    assert.deepEqual(parseGoal("30"), { ok: true, value: 30 });
  });

  it("accepts both ends of the range", () => {
    assert.deepEqual(parseGoal(String(GOAL_MIN)), { ok: true, value: GOAL_MIN });
    assert.deepEqual(parseGoal(String(GOAL_MAX)), { ok: true, value: GOAL_MAX });
  });

  it("tells an empty field apart from a bad one", () => {
    assert.deepEqual(parseGoal(""), { ok: false, reason: "missing" });
    assert.deepEqual(parseGoal("   "), { ok: false, reason: "missing" });
    assert.deepEqual(parseGoal(null), { ok: false, reason: "missing" });
  });

  it("refuses a goal outside the range rather than clamping it", () => {
    // Clamping would store 365 and show it back as though they chose it.
    assert.deepEqual(parseGoal("500"), { ok: false, reason: "out-of-range" });
    assert.deepEqual(parseGoal("1"), { ok: false, reason: "out-of-range" });
    assert.deepEqual(parseGoal("0"), { ok: false, reason: "out-of-range" });
  });

  it("refuses the values Number() would have quietly accepted", () => {
    // Every one of these is a number to JavaScript and not a count of days.
    assert.equal(parseGoal("3.5").ok, false);
    assert.equal(parseGoal("1e3").ok, false);
    assert.equal(parseGoal("0x10").ok, false);
    assert.equal(parseGoal("-7").ok, false);
    assert.equal(parseGoal("Infinity").ok, false);
    assert.equal(parseGoal("thirty").ok, false);
  });

  it("refuses a non-string, because FormData can hand back a File", () => {
    assert.deepEqual(parseGoal(new Blob()), { ok: false, reason: "missing" });
  });
});

describe("nextMilestone", () => {
  it("looks strictly ahead, so landing on one does not re-suggest it", () => {
    assert.equal(nextMilestone(0), 3);
    assert.equal(nextMilestone(3), 7);
    assert.equal(nextMilestone(6), 7);
  });

  it("runs out once every milestone is behind them", () => {
    assert.equal(nextMilestone(365), null);
    assert.equal(nextMilestone(400), null);
  });
});

describe("streakTarget", () => {
  it("measures against the member's own goal when they have set one", () => {
    assert.deepEqual(streakTarget(45, 10), { value: 45, custom: true });
  });

  it("falls back to the next milestone so the card is never empty", () => {
    assert.deepEqual(streakTarget(null, 10), { value: 14, custom: false });
  });

  it("keeps a goal the member has already passed", () => {
    // Their number, still theirs. The page shows it reached rather than
    // silently promoting them to the next milestone.
    assert.deepEqual(streakTarget(7, 40), { value: 7, custom: true });
  });

  it("has nothing to offer past the last milestone", () => {
    // A full bar against a target passed months ago would be a lie.
    assert.equal(streakTarget(null, 400), null);
  });
});

describe("suggestedGoal", () => {
  it("opens the field on what they already chose", () => {
    assert.equal(suggestedGoal(10, 45), 45);
  });

  it("otherwise opens on the next milestone up", () => {
    assert.equal(suggestedGoal(10, null), 14);
  });

  it("never opens on something below the floor", () => {
    assert.ok(suggestedGoal(0, null) >= GOAL_MIN);
    assert.ok(suggestedGoal(400, null) <= GOAL_MAX);
  });
});

describe("goalProgress", () => {
  it("is a fraction of the target", () => {
    assert.equal(goalProgress(15, 30), 0.5);
  });

  it("stops at full, so a passed goal cannot draw a wider bar", () => {
    assert.equal(goalProgress(60, 30), 1);
  });

  it("survives a zero target rather than returning NaN", () => {
    // Not reachable through the form, and a NaN width silently renders as
    // no bar at all — which looks like a bug in the data, not the input.
    assert.equal(goalProgress(5, 0), 0);
  });
});

describe("daysToGo", () => {
  it("counts down", () => {
    assert.equal(daysToGo(11, 14), 3);
  });

  it("never goes negative", () => {
    assert.equal(daysToGo(40, 14), 0);
  });
});
