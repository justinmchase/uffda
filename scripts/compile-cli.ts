#!/usr/bin/env -S deno run --allow-read --allow-write --allow-run --allow-env
/**
 * Cross-compile the Uffda CLI for every Deno compile target.
 *
 * Usage:
 *   deno task compile:cli
 *   deno task compile:cli -- --version 0.1.2 --out-dir ./dist/cli
 */
import { dirname, fromFileUrl, join } from "@std/path";
import { version as packageVersion } from "../src/version.ts";
import {
  artifactFileName,
  checksumFileName,
  DENO_COMPILE_TARGETS,
  type DenoCompileTarget,
  installScriptFileName,
} from "../src/cli/distribution.ts";

function parseArgs(argv: string[]): { version: string; outDir: string } {
  let version = packageVersion;
  let outDir = join(Deno.cwd(), "dist", "cli");
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--version") {
      version = argv[++i] ?? version;
      continue;
    }
    if (arg.startsWith("--version=")) {
      version = arg.slice("--version=".length);
      continue;
    }
    if (arg === "--out-dir") {
      outDir = argv[++i] ?? outDir;
      continue;
    }
    if (arg.startsWith("--out-dir=")) {
      outDir = arg.slice("--out-dir=".length);
    }
  }
  return { version, outDir };
}

async function sha256Hex(path: string): Promise<string> {
  const bytes = await Deno.readFile(path);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function compileTarget(
  target: DenoCompileTarget,
  outputPath: string,
  repoRoot: string,
): Promise<void> {
  const entry = fromFileUrl(new URL("../src/cli/main.ts", import.meta.url));
  const args = [
    "compile",
    "--target",
    target,
    "--output",
    outputPath,
    // Embed compiled language AST JSON so standalone CLIs can remap `.uff`
    // imports without a consumer workspace `./bin` tree.
    "--include",
    "./bin",
    "--allow-read",
    "--allow-write",
    "--allow-env=INIT_CWD,PWD",
    entry,
  ];
  const command = new Deno.Command(Deno.execPath(), {
    args,
    cwd: repoRoot,
    stdout: "inherit",
    stderr: "inherit",
  });
  const { code } = await command.output();
  if (code !== 0) {
    throw new Error(`deno compile failed for ${target} (exit ${code})`);
  }
}

async function main(): Promise<void> {
  const { version, outDir } = parseArgs(Deno.args);
  const repoRoot = dirname(fromFileUrl(import.meta.url)).replace(
    /[/\\]scripts$/,
    "",
  );
  const binDir = join(repoRoot, "bin");
  try {
    const binStat = await Deno.stat(binDir);
    if (!binStat.isDirectory) {
      throw new Error(`Expected ${binDir} to be a directory`);
    }
  } catch (err) {
    throw new Error(
      `Missing ${binDir}. Run \`deno task compile:lang\` before compile:cli.`,
      { cause: err },
    );
  }

  await Deno.mkdir(outDir, { recursive: true });

  const checksumLines: string[] = [];
  for (const target of DENO_COMPILE_TARGETS) {
    const fileName = artifactFileName(version, target);
    const outputPath = join(outDir, fileName);
    console.log(`Compiling ${fileName}...`);
    await compileTarget(target, outputPath, repoRoot);
    const hash = await sha256Hex(outputPath);
    checksumLines.push(`${hash}  ${fileName}`);
  }

  const installSource = join(
    dirname(fromFileUrl(import.meta.url)),
    installScriptFileName(),
  );
  const installDest = join(outDir, installScriptFileName());
  await Deno.copyFile(installSource, installDest);
  checksumLines.push(
    `${await sha256Hex(installDest)}  ${installScriptFileName()}`,
  );

  const sumsPath = join(outDir, checksumFileName());
  await Deno.writeTextFile(sumsPath, `${checksumLines.join("\n")}\n`);
  console.log(`Wrote ${sumsPath}`);
}

if (import.meta.main) {
  await main();
}
