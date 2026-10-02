import {
  type FormatResult,
  formatSource,
  FormatterResolutionKind,
  formatTree,
  type LanguageGrammar,
  resolveFormatter,
} from "../format.ts";
import type { Wrapped } from "../../wrapped.ts";
import type { UffdaSyntaxModule } from "./syntax.types.ts";

/** The `.uff` language's grammar, whose entry rule names its formatter. */
export const UFFDA_GRAMMAR: LanguageGrammar = {
  moduleUrl: new URL("./uffda.lang.uff", import.meta.url),
  entryRuleName: "UffdaLang",
};

/**
 * Formats a Uffda syntax tree as canonical source text with the formatter
 * `UffdaLang` names; see
 * `.agents/specifications/languages/uffda-syntax/formatting.spec.md`.
 */
export async function formatUffdaSyntaxModule(
  module: UffdaSyntaxModule | Wrapped<UffdaSyntaxModule>,
): Promise<FormatResult> {
  const resolution = await resolveFormatter(UFFDA_GRAMMAR);
  if (resolution.kind !== FormatterResolutionKind.Found) {
    throw new Error("UffdaLang does not name a [Formatter]");
  }
  return await formatTree(resolution.formatter, module);
}

/**
 * Parses and formats `source`. A source that does not parse cleanly is
 * never formatted.
 */
export async function formatUffdaSource(
  source: string,
): Promise<FormatResult> {
  return await formatSource(UFFDA_GRAMMAR, source);
}
