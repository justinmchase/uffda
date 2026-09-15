// Maps Node's process.platform/arch to the Deno `--target` triples used by
// .github/workflows/release-binaries.yml, so the extension downloads the
// asset matching the running host.
export function resolveTarget(
  platform: NodeJS.Platform,
  arch: string,
): string | undefined {
  switch (platform) {
    case "linux":
      switch (arch) {
        case "x64":
          return "x86_64-unknown-linux-gnu";
        case "arm64":
          return "aarch64-unknown-linux-gnu";
        default:
          return undefined;
      }
    case "win32":
      switch (arch) {
        case "x64":
          return "x86_64-pc-windows-msvc";
        case "arm64":
          return "aarch64-pc-windows-msvc";
        default:
          return undefined;
      }
    case "darwin":
      switch (arch) {
        case "x64":
          return "x86_64-apple-darwin";
        case "arm64":
          return "aarch64-apple-darwin";
        default:
          return undefined;
      }
    default:
      return undefined;
  }
}

export function assetNameForTarget(version: string, target: string): string {
  const suffix = target.includes("windows") ? ".exe" : "";
  return `uffda-${version}-${target}${suffix}`;
}

export function binaryFileName(target: string): string {
  return target.includes("windows") ? "uffda.exe" : "uffda";
}
