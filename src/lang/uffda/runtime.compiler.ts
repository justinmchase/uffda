import type { Match } from "../../match.ts";
import { MatchKind } from "../../match.ts";
import { InputNormalizationMode } from "../../input.ts";
import type { ModuleDeclaration } from "../../runtime/declarations/module.ts";
import { PatternKind } from "../../runtime/patterns/pattern.kind.ts";
import { ResolveTargetKind } from "../../runtime/patterns/pattern.ts";
import { resolve } from "../../runtime/patterns/resolve.ts";
import { languageArtifactRoots } from "../../runtime/resolvers/language_artifact_roots.ts";
import { ModuleImportResultKind } from "../../runtime/resolvers/resolver.ts";
import { Resolver } from "../../runtime/resolve.ts";
import { Scope } from "../../runtime/scope.ts";
import type { UffdaSyntaxModule } from "./syntax.types.ts";

export type UffdaRuntimeCompilerDiagnostic = {
  matchKind: MatchKind.Fail | MatchKind.Error;
  compilerRule: string;
  sourcePath: string;
};

type CompilerRuleFailure = {
  name: string;
  sourcePath: string;
};

function findCompilerRuleFailure(
  match: Match,
): CompilerRuleFailure | undefined {
  if (
    match.pattern.kind === PatternKind.Resolve &&
    match.pattern.targetKind === ResolveTargetKind.Reference &&
    match.pattern.name.startsWith("Compile") &&
    match.kind !== MatchKind.LR
  ) {
    if (match.pattern.name === "CompileDeclaration") {
      return {
        name: match.pattern.name,
        sourcePath: match.span.start.toString(),
      };
    }
  }

  if (match.kind !== MatchKind.Ok && match.kind !== MatchKind.Fail) {
    return undefined;
  }

  let fallback: CompilerRuleFailure | undefined;
  for (const child of match.matches) {
    const failure = findCompilerRuleFailure(child);
    if (failure?.name === "CompileDeclaration") return failure;
    fallback ??= failure;
  }

  if (fallback) return fallback;
  if (
    match.pattern.kind === PatternKind.Resolve &&
    match.pattern.targetKind === ResolveTargetKind.Reference &&
    match.pattern.name.startsWith("Compile")
  ) {
    return {
      name: match.pattern.name,
      sourcePath: match.span.start.toString(),
    };
  }
  return undefined;
}

export function diagnoseUffdaRuntimeCompilerFailure(
  match: Match,
): UffdaRuntimeCompilerDiagnostic | undefined {
  if (match.kind !== MatchKind.Fail && match.kind !== MatchKind.Error) {
    return undefined;
  }

  const failure = findCompilerRuleFailure(match);
  return {
    matchKind: match.kind,
    compilerRule: failure?.name ?? "UffdaRuntimeCompiler",
    sourcePath: failure?.sourcePath ?? match.span.start.toString(),
  };
}

/**
 * Run the runtime compiler language.
 *
 * Loads `./runtime.compiler.uff` through the module resolver (ModuleDeclaration
 * JSON under `./bin`, produced by compile — resolve only reads it), then runs
 * the `UffdaRuntimeCompiler` entry rule against the given syntax module.
 */
export async function runUffdaRuntimeCompiler(
  syntaxModule: UffdaSyntaxModule,
): Promise<Match<ModuleDeclaration>> {
  const moduleUrl = new URL("./runtime.compiler.uff", import.meta.url);
  const { builtInLanguageDeclarations } = await import("../declarations.ts");
  const { cwd, artifactRoot } = languageArtifactRoots(import.meta.url);
  const resolver = new Resolver({
    declarations: { ...builtInLanguageDeclarations },
    cwd,
    artifactRoot,
  });
  const scope = Scope.From(syntaxModule, {
    kind: InputNormalizationMode.Scalar,
  }).withOptions({
    resolver,
  });

  const imported = await resolver.import(moduleUrl, {
    scope,
    pattern: {
      kind: PatternKind.Resolve,
      targetKind: ResolveTargetKind.Run,
      name: "UffdaRuntimeCompiler",
    },
  });
  if (imported.kind === ModuleImportResultKind.Error) {
    return imported.error;
  }

  return await resolve(
    {
      kind: PatternKind.Resolve,
      targetKind: ResolveTargetKind.Run,
      name: "UffdaRuntimeCompiler",
    },
    scope.pushModule(imported.module),
  ) as Match<ModuleDeclaration>;
}
