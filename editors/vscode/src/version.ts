// Minimum uffda CLI version this extension requires. Keep this in sync with
// the language server / MCP server transport contract this extension relies
// on; bump it whenever the extension starts depending on a newer CLI
// feature (see .agents/specifications/languages/cli/language-server.spec.md
// and .agents/requirements/cli-language-server/007-vscode-extension.requirement.md).
export const MIN_UFFDA_VERSION = "0.2.6";

/** Parses a `major.minor.patch` version string, ignoring any pre-release or build suffix. */
export function parseVersion(raw: string): [number, number, number] | undefined {
  const match = raw.trim().match(/^v?(\d+)\.(\d+)\.(\d+)/);
  if (!match) return undefined;
  const [, major, minor, patch] = match;
  return [Number(major), Number(minor), Number(patch)];
}

/** Returns true when `actual` is greater than or equal to `minimum` (SemVer major.minor.patch only). */
export function satisfiesMinVersion(actual: string, minimum: string): boolean {
  const a = parseVersion(actual);
  const m = parseVersion(minimum);
  if (!a || !m) return false;
  for (let i = 0; i < 3; i++) {
    if (a[i] > m[i]) return true;
    if (a[i] < m[i]) return false;
  }
  return true;
}
