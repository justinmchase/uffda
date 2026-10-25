import { copyFile, chmod, mkdir, readFile, writeFile } from "node:fs/promises";
import { basename, join } from "node:path";
import { pathToFileURL } from "node:url";

export const RUST_PREVIEW_TARGETS = [
  "x86_64-unknown-linux-gnu",
  "aarch64-unknown-linux-gnu",
  "x86_64-pc-windows-msvc",
  "aarch64-pc-windows-msvc",
  "x86_64-apple-darwin",
  "aarch64-apple-darwin",
] as const;

export function rustReleaseAsset(version: string, target: string): string {
  if (
    !/^\d+\.\d+\.\d+(?:-pre\.\d+)?$/.test(version) ||
    !RUST_PREVIEW_TARGETS.some((supported) => supported === target)
  ) {
    throw new Error("Invalid release version or unsupported target");
  }
  return `uffda-${version}-${target}${
    target.includes("windows") ? ".exe" : ""
  }`;
}

export async function packageRustCli(
  source: string,
  version: string,
  target: string,
  outDir: string,
): Promise<string> {
  const asset = rustReleaseAsset(version, target);
  await mkdir(outDir, { recursive: true });
  const output = join(outDir, asset);
  await copyFile(source, output);
  if (!target.includes("windows")) await chmod(output, 0o755);
  const hash = new Uint8Array(
    await crypto.subtle.digest("SHA-256", await readFile(output)),
  );
  const hex = Array.from(hash)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
  await writeFile(output + ".sha256", `${hex}  ${basename(output)}\n`);
  return output;
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const args = process.argv.slice(2);
  if (args.length !== 4) {
    throw new Error(
      "Usage: package-rust-cli.ts <binary> <version> <target> <out-dir>",
    );
  }
  console.log(await packageRustCli(args[0], args[1], args[2], args[3]));
}
