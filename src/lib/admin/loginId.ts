/**
 * Resolving the ID typed on /admin/login to the account it stands for.
 *
 * Pure on purpose. It imports nothing — not `@/lib/env`, which validates
 * at module load and throws, and not the Supabase client — so the rules
 * below are unit-testable, which is the whole reason they live apart from
 * the server action that uses them.
 *
 * ── WHAT IS AND IS NOT A SECRET HERE ────────────────────────────────
 * The ID is not a secret. It is the half of the credential that is
 * allowed to be guessable, and its default is the most guessable word
 * available. Nothing below tries to hide it, and no comparison here is
 * timing-safe, because there is nothing to leak: knowing the ID gets you
 * to the password prompt and no further.
 *
 * The password is the secret, and it is not compared here at all. It goes
 * straight to Supabase, which stores it bcrypt-hashed, compares it in
 * constant time, rate-limits the attempt and checks it against the
 * known-breached corpus. Reimplementing any of that would be strictly
 * worse than calling it.
 *
 * What the action *does* equalise is elapsed time — a matching ID reaches
 * a network call and a non-matching one would not, which would time the
 * ID out loud. See `MINIMUM_FAILURE_MS` in adminAuth.ts.
 * ────────────────────────────────────────────────────────────────────
 */

/**
 * Used when ADMIN_LOGIN_ID is unset, so a fresh deploy needs one variable
 * (the email) rather than two to get a working panel login.
 */
export const DEFAULT_ADMIN_LOGIN_ID = "admin";

export type AdminLoginConfig = {
  /** ADMIN_LOGIN_ID, or undefined to accept the default. */
  readonly id: string | undefined;
  /** ADMIN_LOGIN_EMAIL. Undefined means the feature is not configured. */
  readonly email: string | undefined;
};

export type AdminLoginResolution =
  /** Configured, and the submitted ID matched. Sign in as `email`. */
  | { readonly ok: true; readonly email: string }
  /**
   * ADMIN_LOGIN_EMAIL is unset. Distinguished from a mismatch because the
   * page says something different — and useful — about it: the deploy is
   * incomplete, and no password will ever work until it is fixed.
   */
  | { readonly ok: false; readonly reason: "unconfigured" }
  /** Configured, but the submitted ID is not the one. */
  | { readonly ok: false; readonly reason: "mismatch" };

/**
 * Trim and case-fold.
 *
 * Case-insensitive because "Admin" and "admin" are the same word to
 * everyone except a string comparison, and a login that rejects the
 * capitalised form a phone keyboard produces by default would look broken
 * rather than strict. Whitespace goes because it is invisible — a trailing
 * space pasted from a password manager is not a different ID.
 */
export function normaliseLoginId(raw: string): string {
  return raw.trim().toLowerCase();
}

/**
 * `undefined` and `""` both mean "not set" — Vercel and .env files surface
 * a declared-but-blank variable as an empty string, and treating that as a
 * configured empty ID would accept a submitted blank as a match.
 */
function configured(value: string | undefined): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

export function resolveAdminLogin(
  submittedId: string,
  config: AdminLoginConfig,
): AdminLoginResolution {
  const email = configured(config.email);
  if (email === null) return { ok: false, reason: "unconfigured" };

  /**
   * `configured` has already rejected undefined, "" and whitespace, so an
   * ADMIN_LOGIN_ID of "   " falls back to the default rather than
   * collapsing to an empty expectation that a submitted blank would match.
   * That is why there is no empty check on `expected` below: there is no
   * path that produces one.
   */
  const expected = normaliseLoginId(
    configured(config.id) ?? DEFAULT_ADMIN_LOGIN_ID,
  );

  if (normaliseLoginId(submittedId) !== expected) {
    return { ok: false, reason: "mismatch" };
  }

  return { ok: true, email };
}

/** Where a successful admin sign-in lands when nothing else is asked for. */
export const ADMIN_HOME = "/admin";

/**
 * Validates the `next` the proxy attaches when it turns a signed-out
 * visitor away from a panel URL, so signing in returns them to the page
 * they actually wanted rather than dumping them on the overview.
 *
 * Deliberately stricter than `safeNextPath`, which the member login uses.
 * That one accepts any internal path, which is right for a member — after
 * signing in they may legitimately be going anywhere on the site. This
 * door only ever sends people into the panel, so anything that is not a
 * panel URL is not a destination it should honour, and narrowing it means
 * a crafted link cannot use the admin form as a way to bounce someone
 * somewhere else.
 *
 * Refused, and why each matters:
 *   - an absolute URL, or anything with a scheme — off-site entirely
 *   - "//evil.example" — protocol-relative, so also off-site, and it
 *     passes a naive "starts with /" check
 *   - a backslash anywhere — some browsers normalise "\" to "/", which
 *     turns "/\evil.example" into a protocol-relative URL after the check
 *   - "/administrators" — starts with "/admin" as a string but is not a
 *     panel route, so the boundary is tested at a segment, not a prefix
 *   - "/admin/login" — the door itself, which would loop
 */
export function safeAdminNext(raw: unknown): string {
  if (typeof raw !== "string") return ADMIN_HOME;

  const candidate = raw.trim();
  if (candidate === "" || candidate.includes("\\")) return ADMIN_HOME;
  if (!candidate.startsWith("/") || candidate.startsWith("//")) {
    return ADMIN_HOME;
  }

  // Compare on the path alone: a query string is preserved in the value we
  // return, but must not be able to smuggle a "/" past the segment check.
  //
  // `?? candidate` satisfies noUncheckedIndexedAccess rather than covering a
  // real case — String.split always yields at least one element — and falling
  // back to the whole candidate keeps the checks below strict either way.
  const path = candidate.split(/[?#]/)[0] ?? candidate;
  if (path !== ADMIN_HOME && !path.startsWith(`${ADMIN_HOME}/`)) {
    return ADMIN_HOME;
  }
  if (path === "/admin/login") return ADMIN_HOME;

  return candidate;
}
