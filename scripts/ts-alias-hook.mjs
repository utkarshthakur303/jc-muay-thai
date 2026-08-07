import { existsSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

/**
 * Teaches Node's ESM resolver the "@/" path alias from tsconfig.json.
 *
 * Node runs TypeScript directly now, but it strips types — it does not read
 * tsconfig, so `import "@/lib/format/time"` is just a bare specifier to it
 * and fails as a missing package. Next.js and tsc both resolve it; only the
 * test runner does not.
 *
 * The alternative was to write relative imports in files that have tests
 * and aliased ones everywhere else, which makes a file's import style
 * depend on whether someone got round to testing it. Twenty lines here is
 * cheaper than that inconsistency.
 *
 * If the alias ever changes in tsconfig.json, it changes here too. That is
 * the one duplication this introduces, and it is why ROOT is spelled out
 * rather than derived from something clever.
 */

const ROOT = path.resolve(import.meta.dirname, "..", "src");

/** Extensionless specifiers, the way a bundler resolves them. */
const CANDIDATES = ["", ".ts", ".tsx", "/index.ts", "/index.tsx"];

export function resolve(specifier, context, nextResolve) {
  if (!specifier.startsWith("@/")) {
    return nextResolve(specifier, context);
  }

  const base = path.join(ROOT, specifier.slice(2));

  for (const suffix of CANDIDATES) {
    const candidate = base + suffix;
    if (existsSync(candidate)) {
      return nextResolve(pathToFileURL(candidate).href, context);
    }
  }

  throw new Error(
    `Cannot resolve "${specifier}" under ${ROOT}. Tried: ` +
      CANDIDATES.map((s) => path.basename(base + s)).join(", "),
  );
}
