import {
  type FormatResult,
  formatSource,
  formatTree,
  resolveFormatter,
} from "../format.ts";
import { LanguageRuleResolutionKind } from "../language_rule.ts";
import { UFFDA_GRAMMAR } from "./uffda.lang.ts";
import type { Wrapped } from "../../wrapped.ts";
import type { UffdaSyntaxModule } from "./syntax.types.ts";

/**
 * Formats a Uffda syntax tree as canonical source text with the formatter
 * `UffdaLang` names; see
 * `.agents/specifications/languages/uffda-syntax/formatting.spec.md`.
 */
export async function formatUffdaSyntaxModule(
  module: UffdaSyntaxModule | Wrapped<UffdaSyntaxModule>,
): Promise<FormatResult> {
  const resolution = await resolveFormatter(UFFDA_GRAMMAR);
  if (resolution.kind !== LanguageRuleResolutionKind.Found) {
    throw new Error("UffdaLang does not name a [Formatter]");
  }
  return await formatTree(resolution.rule, module);
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
