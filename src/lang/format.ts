import { Type, type } from "@justinmchase/type";
import { parseGrammar } from "./grammar.ts";
import {
  type LanguageGrammar,
  type LanguageRuleResolution,
  LanguageRuleResolutionKind,
  resolveLanguageRule,
} from "./language_rule.ts";
import type { ModuleDeclaration } from "../runtime/declarations/module.ts";
import { Input, InputNormalizationMode } from "../input.ts";
import { isClean, type Match, MatchKind, valueOf } from "../match.ts";
import type { RuleInfo } from "../runtime/modules/rule_info.ts";
import { unwrap } from "../wrapped.ts";

/** The decorator naming a language's formatter on its entry rule. */
export const FORMATTER_DECORATOR_NAME = "Formatter";

export enum FormatResultKind {
  /** The source parsed cleanly and was formatted. */
  Formatted = "formatted",
  /** The language's entry rule has no `[Formatter]`. */
  NoFormatter = "noFormatter",
  /** The language's grammar could not be resolved. */
  Unresolved = "unresolved",
  /** The source failed to parse, or parsed only by recovering. */
  ParseFailed = "parseFailed",
  /** The formatter failed, or produced something other than text. */
  FormatFailed = "formatFailed",
}

export type FormatResult =
  | { kind: FormatResultKind.Formatted; text: string }
  | { kind: FormatResultKind.NoFormatter }
  | { kind: FormatResultKind.Unresolved; match: Match }
  | { kind: FormatResultKind.ParseFailed; match: Match }
  | { kind: FormatResultKind.FormatFailed; match: Match; message: string };

/**
 * The formatter a language's entry rule names with `[Formatter X]`; see
 * `.agents/specifications/languages/cli/editor-metadata.spec.md`.
 */
export function resolveFormatter(
  grammar: LanguageGrammar,
): Promise<LanguageRuleResolution> {
  return resolveLanguageRule(grammar, FORMATTER_DECORATOR_NAME);
}

/** Runs `formatter` over a parse value, producing the formatted text. */
export async function formatTree(
  formatter: RuleInfo,
  tree: unknown,
  declarations?: Record<string, ModuleDeclaration>,
): Promise<FormatResult> {
  const match = await parseGrammar<string>({
    source: "",
    moduleUrl: new URL(formatter.moduleUrl),
    entryRuleName: formatter.name,
    grammarOptions: {
      input: Input.From(tree, { kind: InputNormalizationMode.Scalar }),
      declarations,
    },
  });
  if (!isClean(match) || match.kind !== MatchKind.Ok) {
    return {
      kind: FormatResultKind.FormatFailed,
      match,
      message: `formatter ${formatter.name} did not match the parse tree`,
    };
  }
  const text = unwrap(valueOf(match));
  if (type(text)[0] !== Type.String) {
    return {
      kind: FormatResultKind.FormatFailed,
      match,
      message: `formatter ${formatter.name} did not produce text`,
    };
  }
  return { kind: FormatResultKind.Formatted, text: text as string };
}

/** Parses `source` with `grammar` and formats it with the language's formatter. */
export async function formatSource(
  grammar: LanguageGrammar,
  source: string,
  formatter?: RuleInfo,
): Promise<FormatResult> {
  if (!formatter) {
    const resolution = await resolveFormatter(grammar);
    switch (resolution.kind) {
      case LanguageRuleResolutionKind.Missing:
        return { kind: FormatResultKind.NoFormatter };
      case LanguageRuleResolutionKind.Unresolved:
        return { kind: FormatResultKind.Unresolved, match: resolution.match };
    }
    formatter = resolution.rule;
  }
  const { moduleUrl, entryRuleName, declarations } = grammar;
  const parsed = await parseGrammar({
    source,
    moduleUrl,
    entryRuleName,
    grammarOptions: { declarations },
  });
  if (!isClean(parsed) || parsed.kind !== MatchKind.Ok) {
    return { kind: FormatResultKind.ParseFailed, match: parsed };
  }
  return await formatTree(formatter, parsed.value, declarations);
}
