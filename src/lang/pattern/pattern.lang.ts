import { type GrammarOptions, parseGrammar } from "../grammar.ts";
import type { Match } from "../../mod.ts";
import type { Pattern } from "../../runtime/patterns/pattern.ts";

export type PatternOptions = GrammarOptions;

export async function patternGrammar(
  pattern: string,
  opts?: PatternOptions,
): Promise<Match<Pattern>> {
  return await parseGrammar<Pattern>({
    source: pattern,
    moduleUrl: new URL("./pattern.lang.uff", import.meta.url),
    entryRuleName: "PatternLang",
    grammarOptions: opts,
  });
}
