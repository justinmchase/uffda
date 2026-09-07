import { type GrammarOptions, parseGrammar } from "../grammar.ts";
import type { Match } from "../../mod.ts";
import type { Expression } from "../../runtime/expressions/mod.ts";

export type ExprOptions = GrammarOptions;

export async function expressionGrammar(
  expression: string,
  opts?: ExprOptions,
): Promise<Match<Expression>> {
  return await parseGrammar<Expression>({
    source: expression,
    moduleUrl: new URL("./expression.lang.uff", import.meta.url),
    entryRuleName: "ExpressionLang",
    grammarOptions: opts,
  });
}
