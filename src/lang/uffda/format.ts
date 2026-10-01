import { parseGrammar } from "../grammar.ts";
import { Input, InputNormalizationMode } from "../../input.ts";
import { isClean, type Match } from "../../match.ts";
import type { Wrapped } from "../../wrapped.ts";
import { uffdaGrammar } from "./uffda.lang.ts";
import type { UffdaSyntaxModule } from "./syntax.types.ts";

/**
 * Formats a Uffda syntax tree as canonical source text; see
 * `.agents/specifications/languages/uffda-syntax/formatting.spec.md`.
 */
export async function formatUffdaSyntaxModule(
  module: UffdaSyntaxModule | Wrapped<UffdaSyntaxModule>,
): Promise<Match<string>> {
  return await parseGrammar<string>({
    source: "",
    moduleUrl: new URL("./format/mod.uff", import.meta.url),
    entryRuleName: "UffdaFormat",
    grammarOptions: {
      input: Input.From(module, { kind: InputNormalizationMode.Scalar }),
    },
  });
}

/**
 * Parses and formats `source`. A source that does not parse cleanly is
 * returned as its parse, never formatted.
 */
export async function formatUffdaSource(
  source: string,
): Promise<Match<UffdaSyntaxModule> | Match<string>> {
  const parsed = await uffdaGrammar(source);
  if (!isClean(parsed) || parsed.kind !== "ok") return parsed;
  return await formatUffdaSyntaxModule(parsed.value);
}
