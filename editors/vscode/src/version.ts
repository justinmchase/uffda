import * as semver from "semver";

// Minimum uffda CLI version this extension requires. Kept in sync with this
// repo's own release version automatically by .github/version.yml (the same
// release automation that bumps deno.jsonc/VERSION/src/version.ts) — bump
// timing tracks this monorepo's release cadence, so the extension only ever
// declares itself compatible with the uffda CLI shipped alongside it.
export const MIN_UFFDA_VERSION = "0.2.6";

/**
 * Returns true when `actual` is greater than or equal to `minimum`, per
 * semver precedence. Both inputs are coerced (via `semver.coerce`) so a bare
 * `--version` output like "uffda 0.2.6" or a "v"-prefixed tag still compares
 * correctly.
 */
export function satisfiesMinVersion(actual: string, minimum: string): boolean {
  const a = semver.coerce(actual);
  const m = semver.coerce(minimum);
  if (!a || !m) return false;
  return semver.gte(a, m);
}
