import type { ModuleDeclaration } from "../../runtime/declarations/module.ts";
import {
  executeModuleDeclaration,
  type ExecuteModuleDeclarationOptions,
} from "../../runtime/module.execute.ts";
import { type Match, MatchKind } from "../../match.ts";
import { parseGrammar } from "../grammar.ts";
import {
  diagnoseUffdaRuntimeCompilerFailure,
  runUffdaRuntimeCompiler,
  type UffdaRuntimeCompilerDiagnostic,
} from "./runtime.compiler.ts";
import { uffdaGrammar } from "./uffda.lang.ts";
import type { UffdaSyntaxModule } from "./syntax.types.ts";

export class UffdaCompilationError extends Error {
  constructor(
    public readonly diagnostic: UffdaRuntimeCompilerDiagnostic,
    public readonly match: Match,
  ) {
    super(
      `Uffda runtime compilation failed in ${diagnostic.compilerRule} at ${diagnostic.sourcePath} with ${diagnostic.matchKind}`,
    );
    this.name = "UffdaCompilationError";
  }
}

export async function compileUffdaSyntaxModule(
  syntaxModule: UffdaSyntaxModule,
): Promise<ModuleDeclaration> {
  const compiled = await runUffdaRuntimeCompiler(syntaxModule);
  if (compiled.kind === MatchKind.Ok) {
    return compiled.value;
  }

  const diagnostic = diagnoseUffdaRuntimeCompilerFailure(compiled);
  if (!diagnostic) {
    throw new Error(`Uffda runtime compilation failed with ${compiled.kind}`);
  }
  throw new UffdaCompilationError(diagnostic, compiled);
}

/**
 * Parses and lowers raw `.uff` source text directly to a ModuleDeclaration in
 * one pattern-match pipeline (`CompileUffdaSource` in `./compile.uff`: text
 * `|>` UffdaLang `|>` UffdaRuntimeCompiler), instead of gluing `uffdaGrammar`
 * and `compileUffdaSyntaxModule` together imperatively in TypeScript.
 */
export async function compileUffdaSource(
  source: string,
): Promise<Match<ModuleDeclaration>> {
  return await parseGrammar<ModuleDeclaration>({
    source,
    moduleUrl: new URL("./compile.uff", import.meta.url),
    entryRuleName: "CompileUffdaSource",
  });
}

export type ExecuteUffdaSourceOptions = ExecuteModuleDeclarationOptions;

export async function executeUffdaSource(
  source: string,
  options?: ExecuteUffdaSourceOptions,
): Promise<Match> {
  const parsed = await uffdaGrammar(source);
  if (parsed.kind !== MatchKind.Ok) {
    return parsed;
  }

  const compiled = await runUffdaRuntimeCompiler(parsed.value);
  if (compiled.kind !== MatchKind.Ok) {
    return compiled;
  }

  return await executeModuleDeclaration(compiled.value, options);
}
