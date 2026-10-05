/** Deno `compile --target` values published for every CLI release. */
export const DENO_COMPILE_TARGETS = [
  "x86_64-unknown-linux-gnu",
  "aarch64-unknown-linux-gnu",
  "x86_64-pc-windows-msvc",
  "aarch64-pc-windows-msvc",
  "x86_64-apple-darwin",
  "aarch64-apple-darwin",
] as const;

export type DenoCompileTarget = typeof DENO_COMPILE_TARGETS[number];

/**
 * Permissions baked into every compiled CLI (`scripts/compile-cli.ts` and the
 * Release Binaries workflow must both use exactly these). `XDG_RUNTIME_DIR`
 * is read by `vscode-jsonrpc` as soon as the language server module loads,
 * which `main.ts` does for every command. `jsr:` imports are downloaded
 * from `jsr.io` into the cache `HOME`, `XDG_CACHE_HOME` or `LOCALAPPDATA`
 * locates (see `modules.spec.md#packages`).
 */
export const CLI_COMPILE_PERMISSION_FLAGS = [
  "--allow-read",
  "--allow-write",
  "--allow-net=jsr.io",
  "--allow-env=INIT_CWD,PWD,XDG_RUNTIME_DIR,HOME,XDG_CACHE_HOME,LOCALAPPDATA",
] as const;

export function isDenoCompileTarget(
  value: string,
): value is DenoCompileTarget {
  return (DENO_COMPILE_TARGETS as readonly string[]).includes(value);
}

export function artifactFileName(
  version: string,
  target: DenoCompileTarget,
): string {
  const base = `uffda-${version}-${target}`;
  return target.includes("windows") ? `${base}.exe` : base;
}

export function checksumFileName(): string {
  return "SHA256SUMS";
}

export function installScriptFileName(): string {
  return "install.sh";
}

/**
 * Map GitHub Actions runner OS/arch (or Node-style values) to a Deno compile
 * target. Returns undefined when the combination is unsupported.
 */
export function targetFromRunner(
  os: string,
  arch: string,
): DenoCompileTarget | undefined {
  const normalizedOs = os.toLowerCase();
  const normalizedArch = arch.toLowerCase();

  const isLinux = normalizedOs === "linux" || normalizedOs === "ubuntu";
  const isWindows = normalizedOs === "windows" || normalizedOs === "win32";
  const isMac = normalizedOs === "macos" ||
    normalizedOs === "darwin" ||
    normalizedOs === "osx";

  const isX64 = normalizedArch === "x64" ||
    normalizedArch === "x86_64" ||
    normalizedArch === "amd64";
  const isArm64 = normalizedArch === "arm64" ||
    normalizedArch === "aarch64";

  if (isLinux && isX64) return "x86_64-unknown-linux-gnu";
  if (isLinux && isArm64) return "aarch64-unknown-linux-gnu";
  if (isWindows && isX64) return "x86_64-pc-windows-msvc";
  if (isWindows && isArm64) return "aarch64-pc-windows-msvc";
  if (isMac && isX64) return "x86_64-apple-darwin";
  if (isMac && isArm64) return "aarch64-apple-darwin";
  return undefined;
}

export function linuxTargetFromUnameArch(
  arch: string,
): DenoCompileTarget | undefined {
  const normalized = arch.toLowerCase();
  if (
    normalized === "x86_64" || normalized === "amd64"
  ) {
    return "x86_64-unknown-linux-gnu";
  }
  if (
    normalized === "aarch64" || normalized === "arm64"
  ) {
    return "aarch64-unknown-linux-gnu";
  }
  return undefined;
}

/**
 * GitHub release tag lookup order for installer inputs.
 * This repository publishes bare SemVer tags; a leading `v` is also accepted.
 */
export function releaseTagCandidates(versionInput: string): string[] {
  if (versionInput === "latest") {
    return ["latest"];
  }
  const bare = versionInput.replace(/^v/i, "");
  return [`${bare}`, `v${bare}`];
}
