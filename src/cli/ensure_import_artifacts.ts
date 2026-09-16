import { fromFileUrl, join, resolve } from "@std/path";
import { ImportDeclarationKind } from "../runtime/declarations/import.ts";
import type { ModuleDeclaration } from "../runtime/declarations/module.ts";
import { isModuleDeclaration } from "../runtime/declarations/is_module_declaration.ts";
import { astArtifactPathForUffUrl } from "../runtime/resolvers/artifact_path.ts";
import { compileSourcesToAstArtifacts } from "./compile.ts";

export type EnsureImportArtifactsOptions = {
  cwd: string;
  /**
   * Session/runtime artifact root (relative to `cwd` or absolute). Compiled
   * `.uff` imports are written under `<artifactRoot>/ast/…`.
   */
  artifactRoot: string;
  /** Logical URL of the module whose imports are being ensured. */
  moduleUrl: URL;
  declaration: ModuleDeclaration;
  /**
   * Declarations already available in memory (session graph + the module
   * currently being loaded). Those URLs need no disk artifact for this load.
   */
  knownDeclarations: ReadonlyMap<string, ModuleDeclaration>;
};

export type EnsureImportArtifactsResult =
  | { ok: true }
  | { ok: false; message: string };

function isFileUffUrl(url: URL): boolean {
  return url.protocol === "file:" && url.pathname.endsWith(".uff");
}

/**
 * Walks `declaration`'s transitive `.uff` module imports and ensures each
 * file:// dependency has a compiled ModuleDeclaration artifact under the
 * session's artifact root (default `.uffda`), compiling from source when the
 * artifact is missing or older than the source.
 *
 * Kept outside `UffArtifactResolver` on purpose: resolve only loads JSON (see
 * compiler-bootstrap). Compile-on-demand belongs at the session/CLI layer that
 * owns the artifact root.
 */
export async function ensureCompiledImportArtifacts(
  options: EnsureImportArtifactsOptions,
): Promise<EnsureImportArtifactsResult> {
  const { cwd, artifactRoot, moduleUrl, declaration, knownDeclarations } =
    options;
  const absArtifactRoot = resolve(cwd, artifactRoot);
  const outputDir = join(absArtifactRoot, "ast");

  const pending: URL[] = [];
  const seen = new Set<string>();

  const enqueueImports = (decl: ModuleDeclaration, from: URL) => {
    for (const imp of decl.imports) {
      if (imp.kind !== ImportDeclarationKind.Module) continue;
      let url: URL;
      try {
        url = new URL(imp.moduleUrl, from);
      } catch {
        continue;
      }
      if (!isFileUffUrl(url)) continue;
      if (seen.has(url.href)) continue;
      seen.add(url.href);
      pending.push(url);
    }
  };

  enqueueImports(declaration, moduleUrl);

  while (pending.length > 0) {
    const url = pending.shift()!;

    const known = knownDeclarations.get(url.href);
    if (known) {
      enqueueImports(known, url);
      continue;
    }

    const artifactPath = astArtifactPathForUffUrl(cwd, absArtifactRoot, url);
    const sourcePath = fromFileUrl(url);

    let sourceStat: Deno.FileInfo | undefined;
    try {
      sourceStat = await Deno.stat(sourcePath);
    } catch {
      // Source is absent — leave resolution to the read-only resolver so
      // earlier imports in the same load can still populate
      // `resolvedDuringLoad`. Do not invent a compile failure here.
      continue;
    }

    let needsCompile = true;
    try {
      const artifactStat = await Deno.stat(artifactPath);
      const artifactMtime = artifactStat.mtime?.getTime() ?? 0;
      const sourceMtime = sourceStat.mtime?.getTime() ?? 0;
      if (artifactMtime >= sourceMtime) {
        needsCompile = false;
      }
    } catch {
      // Artifact missing — compile below.
    }

    if (!needsCompile) {
      try {
        const text = await Deno.readTextFile(artifactPath);
        const parsed: unknown = JSON.parse(text);
        if (isModuleDeclaration(parsed)) {
          enqueueImports(parsed, url);
        }
      } catch (error) {
        return {
          ok: false,
          message:
            `Unable to read compiled import artifact for ${url.href} at ${artifactPath}: ${
              error instanceof Error ? error.message : String(error)
            }`,
        };
      }
      continue;
    }

    const compiled = await compileSourcesToAstArtifacts({
      cwd,
      sourcePaths: [sourcePath],
      outputDir,
      overwrite: true,
    });
    if (!compiled.ok) {
      const failure = compiled.failures[0];
      return {
        ok: false,
        message: failure
          ? `${failure.code}: ${failure.message}`
          : `Failed to compile import ${url.href}`,
      };
    }
    for (const success of compiled.successes) {
      enqueueImports(success.module, url);
    }
  }

  return { ok: true };
}
