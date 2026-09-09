#!/usr/bin/env -S deno run --allow-read --allow-write --allow-run --allow-net --allow-env
/**
 * Bootstrap compile:lang pipeline.
 *
 * 1. Previous published `uffda compile` parses .uff using languages embedded in
 *    that CLI (workspace ./bin may be empty — in-tree grammar cannot).
 *    Pin to 0.1.15 until 0.1.17+ (this fix) is published: 0.1.16's binary
 *    cannot lower (dynamic JSR import).
 * 2. Lower stage: frozen previous UffdaRuntimeCompiler → ModuleDeclaration.
 *
 * After 0.1.17+ is the installed previous CLI, this task can collapse to a
 * single `uffda compile` (that binary already emits ModuleDeclarations).
 *
 * Resolve later only loads that JSON (no recursion). See
 * compiler-bootstrap.spec.md § Compile pipeline and recursion break.
 */
import { expandGlob } from "@std/fs/expand-glob";
import { dirname, fromFileUrl, join, resolve } from "@std/path";
import { lowerUffdaSyntaxModule } from "./lower_uffda_syntax.ts";
import { isModuleDeclaration } from "../runtime/declarations/is_module_declaration.ts";
import type { UffdaSyntaxModule } from "../lang/uffda/syntax.types.ts";

function isUffdaSyntaxModule(value: unknown): value is UffdaSyntaxModule {
  if (value === null || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return record.kind === "module" && Array.isArray(record.declarations);
}

const repoRoot = resolve(dirname(fromFileUrl(import.meta.url)), "../..");
const outDir = resolve(repoRoot, "bin");
const glob = "src/lang/**/*.uff";

async function runPreviousCliCompile(): Promise<void> {
  const cmd = new Deno.Command("uffda", {
    args: ["compile", glob, "--out-dir", outDir],
    cwd: repoRoot,
    stdout: "inherit",
    stderr: "inherit",
  });
  const { code } = await cmd.output();
  if (code !== 0) {
    Deno.exit(code);
  }
}

async function lowerBinArtifacts(): Promise<void> {
  const root = join(outDir, "ast");
  let lowered = 0;
  let already = 0;
  for await (
    const entry of expandGlob("**/*.uffda.ast.json", {
      root,
      includeDirs: false,
    })
  ) {
    const parsed = JSON.parse(await Deno.readTextFile(entry.path));
    if (isModuleDeclaration(parsed)) {
      already++;
      continue;
    }
    if (!isUffdaSyntaxModule(parsed)) {
      console.error(`Unrecognized artifact shape: ${entry.path}`);
      Deno.exit(1);
    }
    const declaration = await lowerUffdaSyntaxModule(parsed);
    await Deno.writeTextFile(
      entry.path,
      `${JSON.stringify(declaration, null, 2)}\n`,
    );
    lowered++;
  }
  console.log(
    `compile:lang lower stage: ${lowered} ModuleDeclaration(s)` +
      (already ? ` (${already} already lowered)` : ""),
  );
}

await Deno.remove(outDir, { recursive: true }).catch(() => {});
await runPreviousCliCompile();
await lowerBinArtifacts();
