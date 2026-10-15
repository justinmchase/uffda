import { basename, join } from "@std/path";

export const RUST_PREVIEW_TARGETS = [
  "x86_64-unknown-linux-gnu",
  "aarch64-unknown-linux-gnu",
  "x86_64-pc-windows-msvc",
  "aarch64-pc-windows-msvc",
  "x86_64-apple-darwin",
  "aarch64-apple-darwin",
] as const;

export function rustPreviewAsset(version: string, target: string): string {
  if (
    !/^\d+\.\d+\.\d+(?:-pre\.\d+)?$/.test(version) ||
    !RUST_PREVIEW_TARGETS.some((supported) => supported === target)
  ) {
    throw new Error("Invalid preview version or unsupported target");
  }
  return `uffdar-${version}-${target}${
    target.includes("windows") ? ".exe" : ""
  }`;
}

export async function packageRustCli(
  source: string,
  version: string,
  target: string,
  outDir: string,
): Promise<string> {
  const asset = rustPreviewAsset(version, target);
  await Deno.mkdir(outDir, { recursive: true });
  const output = join(outDir, asset);
  await Deno.copyFile(source, output);
  if (!target.includes("windows")) await Deno.chmod(output, 0o755);
  const hash = new Uint8Array(
    await crypto.subtle.digest("SHA-256", await Deno.readFile(output)),
  );
  const hex = Array.from(hash).map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
  await Deno.writeTextFile(output + ".sha256", `${hex}  ${basename(output)}\n`);
  return output;
}

if (import.meta.main) {
  if (Deno.args.length !== 4) {
    throw new Error(
      "Usage: package-rust-cli.ts <binary> <version> <target> <out-dir>",
    );
  }
  console.log(
    await packageRustCli(
      Deno.args[0],
      Deno.args[1],
      Deno.args[2],
      Deno.args[3],
    ),
  );
}
