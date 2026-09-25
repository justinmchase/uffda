import { fromFileUrl, join, resolve } from "@std/path";
import { ImportDeclarationKind } from "../runtime/declarations/import.ts";
import type { ModuleDeclaration } from "../runtime/declarations/module.ts";
import { isModuleDeclaration } from "../runtime/declarations/is_module_declaration.ts";
import { astArtifactPathForUffUrl } from "../runtime/resolvers/artifact_path.ts";
import type { ImportFrame } from "../runtime/resolvers/resolver.ts";
import { compileSourcesToAstArtifacts } from "./compile.ts";
import type { CliStreamFailureLocation } from "./stream.ts";

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

/** The transitive import whose source could not be compiled or read. */
export type EnsureImportDependencyFailure = {
  /** URL of the failing dependency module. */
  moduleUrl: string;
  message: string;
  /** Position inside the dependency's source, when known. */
  location?: CliStreamFailureLocation;
};

export type EnsureImportArtifactsResult =
  | {
    ok: true;
    /**
     * `file:` hrefs of imports whose `.uff` source does not exist. They are
     * left for the resolver (see `resolvedDuringLoad`), which reports them
     * only if nothing else supplied the module.
     */
    missingSources: ReadonlySet<string>;
  }
  | {
    ok: false;
    message: string;
    /** Import edges from `moduleUrl` down to the failing dependency. */
    importChain: ImportFrame[];
    dependency: EnsureImportDependencyFailure;
  };

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
  const chains = new Map<string, ImportFrame[]>();
  const missingSources = new Set<string>();

  const enqueueImports = (
    decl: ModuleDeclaration,
    from: URL,
    chain: ImportFrame[],
  ) => {
    for (const [importIndex, imp] of decl.imports.entries()) {
      if (imp.kind !== ImportDeclarationKind.Module) continue;
      let url: URL;
      try {
        url = new URL(imp.moduleUrl, from);
      } catch {
        continue;
      }
      if (!isFileUffUrl(url)) continue;
      if (chains.has(url.href)) continue;
      chains.set(url.href, [...chain, {
        importerUrl: from.href,
        importIndex,
        moduleUrl: imp.moduleUrl,
        resolvedUrl: url.href,
      }]);
      pending.push(url);
    }
  };

  const failure = (
    url: URL,
    message: string,
    location?: CliStreamFailureLocation,
  ): EnsureImportArtifactsResult => ({
    ok: false,
    message,
    importChain: chains.get(url.href) ?? [],
    dependency: {
      moduleUrl: url.href,
      message,
      ...(location ? { location } : {}),
    },
  });

  enqueueImports(declaration, moduleUrl, []);

  while (pending.length > 0) {
    const url = pending.shift()!;
    const chain = chains.get(url.href)!;

    const known = knownDeclarations.get(url.href);
    if (known) {
      enqueueImports(known, url, chain);
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
      missingSources.add(url.href);
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
          enqueueImports(parsed, url, chain);
        }
      } catch (error) {
        return failure(
          url,
          `Unable to read compiled import artifact for ${url.href} at ${artifactPath}: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
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
      const compileFailure = compiled.failures[0];
      return compileFailure
        ? failure(
          url,
          `${compileFailure.code}: ${compileFailure.message}`,
          compileFailure.location,
        )
        : failure(url, `Failed to compile import ${url.href}`);
    }
    for (const success of compiled.successes) {
      enqueueImports(success.module, url, chain);
    }
  }

  return { ok: true, missingSources };
}
