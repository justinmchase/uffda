import { type GrammarOptions, parseGrammar } from "../grammar.ts";
import type { Match } from "../../mod.ts";
import type { UffdaSyntaxModule } from "./syntax.types.ts";

export type {
  UffdaExportSyntaxDeclaration,
  UffdaImportSyntaxDeclaration,
  UffdaRuleSyntaxDeclaration,
  UffdaSyntaxDeclaration,
  UffdaSyntaxModule,
} from "./syntax.types.ts";

export type UffdaOptions = GrammarOptions;

export async function uffdaGrammar(
  source: string,
  opts?: UffdaOptions,
): Promise<Match<UffdaSyntaxModule>> {
  return await parseGrammar<UffdaSyntaxModule>({
    source,
    moduleUrl: new URL("./uffda.lang.uff", import.meta.url),
    entryRuleName: "UffdaLang",
    grammarOptions: opts,
  });
}

export {
  compileUffdaSyntaxModule,
  executeUffdaSource,
  type ExecuteUffdaSourceOptions,
  UffdaCompilationError,
} from "./execute.ts";
export {
  diagnoseUffdaRuntimeCompilerFailure,
  runUffdaRuntimeCompiler,
  UffdaRuntimeCompiler,
  type UffdaRuntimeCompilerDiagnostic,
} from "./runtime.compiler.ts";
