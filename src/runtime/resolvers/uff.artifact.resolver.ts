import { fromFileUrl } from "@std/path";
import type { UffdaSyntaxModule } from "../../lang/uffda/syntax.types.ts";
import { isModuleDeclaration } from "../declarations/is_module_declaration.ts";
import {
  type IModuleResolver,
  moduleDeclarationResolutionResult,
  type ModuleDeclarationResult,
  moduleDeclarationResult,
  type ModuleResolutionContext,
  moduleResolutionError,
} from "./resolver.ts";
import {
  type ArtifactLayout,
  artifactPathForUffUrl,
  DEFAULT_OUT_DIR,
  packageArtifactUrl,
} from "./artifact_path.ts";

function isUffdaSyntaxModule(value: unknown): value is UffdaSyntaxModule {
  if (value === null || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return record.kind === "module" && Array.isArray(record.declarations);
}

/**
 * Validates the parsed artifact JSON of a `.uff` module, read from
 * `artifactLabel`, into a `ModuleDeclarationResult`. Shared by the
 * filesystem-layout ({@link UffArtifactResolver}) and package-URL
 * ({@link PackageUffArtifactResolver}) resolvers so both reject syntax-AST and
 * non-ModuleDeclaration artifacts the same way.
 */
function toModuleDeclarationResult(
  parsed: unknown,
  artifactLabel: string,
  context: ModuleResolutionContext,
): ModuleDeclarationResult {
  if (isModuleDeclaration(parsed)) {
    return moduleDeclarationResult(parsed);
  }

  if (isUffdaSyntaxModule(parsed)) {
    return moduleDeclarationResolutionResult(moduleResolutionError(
      `Artifact at ${artifactLabel} is a syntax AST; recompile with a CLI ` +
        `that emits ModuleDeclarations (imports/exports/rules)`,
      context,
    ));
  }

  return moduleDeclarationResolutionResult(moduleResolutionError(
    `Artifact at ${artifactLabel} is not a ModuleDeclaration`,
    context,
  ));
}

/** Reads an artifact's text by URL: local files directly, others via fetch. */
async function readArtifactText(url: URL): Promise<string> {
  if (url.protocol === "file:") {
    return await Deno.readTextFile(fromFileUrl(url));
  }
  const response = await fetch(url);
  if (!response.ok) {
    await response.body?.cancel();
    throw new Error(`fetching ${url.href} failed with ${response.status}`);
  }
  return await response.text();
}

/**
 * Resolves logical `.uff` module URLs by loading their compiled JSON from
 * the artifact layout (`<outDir>/ast/...`).
 *
 * Artifacts are ModuleDeclarations produced by the compile pipeline (parse →
 * previous published UffdaRuntimeCompiler → write). Resolve only loads JSON —
 * it does not call the runtime compiler again.
 */
export class UffArtifactResolver implements IModuleResolver {
  public readonly extension = ".uff";

  constructor(private readonly layout: ArtifactLayout) {}

  async resolveModule(
    moduleUrl: URL,
    context: ModuleResolutionContext,
  ): Promise<ModuleDeclarationResult> {
    const artifactPath = artifactPathForUffUrl(this.layout, moduleUrl);
    if (artifactPath === undefined) {
      return moduleDeclarationResolutionResult(moduleResolutionError(
        `Unable to resolve ${moduleUrl}: it is outside ${this.layout.root}, ` +
          `so it has no compiled artifact under ${this.layout.outDir}`,
        context,
      ));
    }

    let text: string;
    try {
      text = await Deno.readTextFile(artifactPath);
    } catch (err) {
      return moduleDeclarationResolutionResult(moduleResolutionError(
        `Unable to resolve ${moduleUrl}: compile the .uff source first ` +
          `(expected artifact at ${artifactPath})`,
        context,
        err,
      ));
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch (err) {
      return moduleDeclarationResolutionResult(moduleResolutionError(
        `Unable to parse module artifact at ${artifactPath}`,
        context,
        err,
      ));
    }

    return toModuleDeclarationResult(parsed, artifactPath, context);
  }
}

/**
 * Resolves logical `.uff` module URLs for a package by loading compiled
 * ModuleDeclaration JSON from that package, addressed by URL relative to
 * `packageRoot` (`<packageRoot>/<outDir>/ast/...`). Unlike
 * {@link UffArtifactResolver}, this works whatever protocol the package is
 * served over: a `file:` checkout or compiled-binary extract root reads the
 * file directly, and a published `https:` package is fetched. `outDir` is the
 * package-relative output directory used when compiling the package, defaulting
 * to `./bin`. Resolve only loads JSON — it does not call the runtime compiler
 * again.
 */
export class PackageUffArtifactResolver implements IModuleResolver {
  public readonly extension = ".uff";

  constructor(
    private readonly packageRoot: URL,
    private readonly outDir: string = DEFAULT_OUT_DIR,
  ) {}

  async resolveModule(
    moduleUrl: URL,
    context: ModuleResolutionContext,
  ): Promise<ModuleDeclarationResult> {
    const artifactUrl = packageArtifactUrl(
      this.packageRoot,
      moduleUrl,
      this.outDir,
    );
    if (artifactUrl === undefined) {
      return moduleDeclarationResolutionResult(moduleResolutionError(
        `Unable to resolve ${moduleUrl}: it is outside the package at ` +
          `${this.packageRoot.href}, so it has no compiled artifact`,
        context,
      ));
    }

    let text: string;
    try {
      text = await readArtifactText(artifactUrl);
    } catch (err) {
      return moduleDeclarationResolutionResult(moduleResolutionError(
        `Unable to resolve ${moduleUrl}: compile the .uff source first ` +
          `(expected artifact at ${artifactUrl.href})`,
        context,
        err,
      ));
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch (err) {
      return moduleDeclarationResolutionResult(moduleResolutionError(
        `Unable to parse module artifact at ${artifactUrl.href}`,
        context,
        err,
      ));
    }

    return toModuleDeclarationResult(parsed, artifactUrl.href, context);
  }
}
