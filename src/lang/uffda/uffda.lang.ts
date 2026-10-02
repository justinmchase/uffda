import { type GrammarOptions, parseGrammar } from "../grammar.ts";
import type { LanguageGrammar } from "../language_rule.ts";
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

/**
 * The `.uff` language's grammar, whose entry rule names its formatter and
 * comment toggle.
 */
export const UFFDA_GRAMMAR: LanguageGrammar = {
  moduleUrl: new URL("./uffda.lang.uff", import.meta.url),
  entryRuleName: "UffdaLang",
};

export async function uffdaGrammar(
  source: string,
  opts?: UffdaOptions,
): Promise<Match<UffdaSyntaxModule>> {
  return await parseGrammar<UffdaSyntaxModule>({
    source,
    moduleUrl: UFFDA_GRAMMAR.moduleUrl,
    entryRuleName: UFFDA_GRAMMAR.entryRuleName,
    grammarOptions: opts,
  });
}

export {
  compileUffdaSource,
  compileUffdaSyntaxModule,
  executeUffdaSource,
  type ExecuteUffdaSourceOptions,
  UffdaCompilationError,
} from "./execute.ts";
export {
  diagnoseUffdaRuntimeCompilerFailure,
  runUffdaRuntimeCompiler,
  type UffdaRuntimeCompilerDiagnostic,
} from "./runtime.compiler.ts";
