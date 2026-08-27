import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  ADMIN_HOME,
  DEFAULT_ADMIN_LOGIN_ID,
  normaliseLoginId,
  resolveAdminLogin,
  safeAdminNext,
} from "./loginId.ts";

/**
 * The ID typed at the admin door decides which account a password is
 * checked against. Every case below is a way the environment or a
 * keystroke could make it decide wrongly — accepting a blank, falling back
 * to an account nobody configured, or refusing the owner because his phone
 * capitalised the first letter.
 */

const EMAIL = "panel@jcmuaythai.test";

describe("normalising a submitted ID", () => {
  it("trims surrounding whitespace", () => {
    assert.equal(normaliseLoginId("  admin  "), "admin");
  });

  it("case-folds", () => {
    assert.equal(normaliseLoginId("AdMiN"), "admin");
  });

  it("leaves an already-clean value alone", () => {
    assert.equal(normaliseLoginId("frontdesk"), "frontdesk");
  });
});

describe("resolving the ID against the configured account", () => {
  it("accepts the default ID when none is configured", () => {
    assert.deepEqual(resolveAdminLogin("admin", { id: undefined, email: EMAIL }), {
      ok: true,
      email: EMAIL,
    });
  });

  it("accepts a configured ID", () => {
    assert.deepEqual(
      resolveAdminLogin("frontdesk", { id: "frontdesk", email: EMAIL }),
      { ok: true, email: EMAIL },
    );
  });

  it("rejects the default once a different ID is configured", () => {
    assert.deepEqual(
      resolveAdminLogin(DEFAULT_ADMIN_LOGIN_ID, {
        id: "frontdesk",
        email: EMAIL,
      }),
      { ok: false, reason: "mismatch" },
    );
  });

  it("ignores case and padding on both sides of the comparison", () => {
    assert.deepEqual(
      resolveAdminLogin("  FrontDesk ", { id: " FRONTDESK  ", email: EMAIL }),
      { ok: true, email: EMAIL },
    );
  });

  it("rejects a wrong ID", () => {
    assert.deepEqual(resolveAdminLogin("root", { id: undefined, email: EMAIL }), {
      ok: false,
      reason: "mismatch",
    });
  });

  it("rejects a blank submission", () => {
    assert.deepEqual(resolveAdminLogin("   ", { id: undefined, email: EMAIL }), {
      ok: false,
      reason: "mismatch",
    });
  });
});

describe("refusing to guess when the deploy is incomplete", () => {
  it("reports unconfigured when the email is unset", () => {
    assert.deepEqual(
      resolveAdminLogin("admin", { id: undefined, email: undefined }),
      { ok: false, reason: "unconfigured" },
    );
  });

  /**
   * Vercel and .env files both surface a declared-but-blank variable as
   * "" rather than undefined, so this is the shape a half-finished
   * deploy actually takes — not a hypothetical.
   */
  it("treats a blank email as unset", () => {
    assert.deepEqual(resolveAdminLogin("admin", { id: undefined, email: "" }), {
      ok: false,
      reason: "unconfigured",
    });
  });

  it("treats a whitespace-only email as unset", () => {
    assert.deepEqual(resolveAdminLogin("admin", { id: undefined, email: "  " }), {
      ok: false,
      reason: "unconfigured",
    });
  });

  /**
   * A blank ID must fall back to the default, never to "accept anything".
   * If it collapsed to an empty expectation, a submitted blank would
   * match it and the ID would stop being part of the credential.
   */
  it("falls back to the default when the ID is blank", () => {
    assert.deepEqual(resolveAdminLogin("admin", { id: "   ", email: EMAIL }), {
      ok: true,
      email: EMAIL,
    });
    assert.deepEqual(resolveAdminLogin("", { id: "   ", email: EMAIL }), {
      ok: false,
      reason: "mismatch",
    });
  });

  it("trims the email it hands back", () => {
    assert.deepEqual(
      resolveAdminLogin("admin", { id: undefined, email: `  ${EMAIL}  ` }),
      { ok: true, email: EMAIL },
    );
  });
});

describe("choosing where a successful admin sign-in lands", () => {
  it("returns a panel path unchanged", () => {
    assert.equal(safeAdminNext("/admin/members"), "/admin/members");
  });

  it("keeps a query string on a panel path", () => {
    assert.equal(
      safeAdminNext("/admin/classes?day=friday"),
      "/admin/classes?day=friday",
    );
  });

  it("accepts the panel root", () => {
    assert.equal(safeAdminNext("/admin"), "/admin");
  });

  it("falls back when nothing was asked for", () => {
    assert.equal(safeAdminNext(undefined), ADMIN_HOME);
    assert.equal(safeAdminNext(""), ADMIN_HOME);
    assert.equal(safeAdminNext("   "), ADMIN_HOME);
  });

  /**
   * `searchParams` hands back an array when a key appears twice, and
   * "?next=/admin&next=https://evil.example" is exactly how someone would
   * try to make that happen.
   */
  it("refuses anything that is not a string", () => {
    assert.equal(safeAdminNext(["/admin/members"]), ADMIN_HOME);
    assert.equal(safeAdminNext(null), ADMIN_HOME);
    assert.equal(safeAdminNext(42), ADMIN_HOME);
  });

  it("refuses an absolute URL", () => {
    assert.equal(safeAdminNext("https://evil.example/admin"), ADMIN_HOME);
  });

  /** Passes a naive "starts with /" check and still leaves the site. */
  it("refuses a protocol-relative URL", () => {
    assert.equal(safeAdminNext("//evil.example"), ADMIN_HOME);
    assert.equal(safeAdminNext("//evil.example/admin"), ADMIN_HOME);
  });

  /** Some browsers normalise "\\" to "/" after the check has passed. */
  it("refuses anything containing a backslash", () => {
    assert.equal(safeAdminNext("/\\evil.example"), ADMIN_HOME);
    assert.equal(safeAdminNext("/admin\\..\\account"), ADMIN_HOME);
  });

  it("refuses a member path", () => {
    assert.equal(safeAdminNext("/account"), ADMIN_HOME);
    assert.equal(safeAdminNext("/"), ADMIN_HOME);
  });

  /** Starts with "/admin" as a string but is not a panel route. */
  it("tests the boundary at a segment, not a prefix", () => {
    assert.equal(safeAdminNext("/administrators"), ADMIN_HOME);
    assert.equal(safeAdminNext("/admin-tools/secrets"), ADMIN_HOME);
  });

  it("refuses the door itself, which would loop", () => {
    assert.equal(safeAdminNext("/admin/login"), ADMIN_HOME);
  });

  /** A "/" in the query must not buy passage through the segment check. */
  it("judges the path, not the query", () => {
    assert.equal(safeAdminNext("/account?x=/admin/members"), ADMIN_HOME);
  });
});
