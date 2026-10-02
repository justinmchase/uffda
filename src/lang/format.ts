import { Type, type } from "@justinmchase/type";
import { parseGrammar, resolveGrammarModule } from "./grammar.ts";
import type { ModuleDeclaration } from "../runtime/declarations/module.ts";
import { Input, InputNormalizationMode } from "../input.ts";
import { isClean, type Match, MatchKind, valueOf } from "../match.ts";
import type { RuleInfo } from "../runtime/modules/rule_info.ts";
import { unwrap } from "../wrapped.ts";

/** The decorator naming a language's formatter on its entry rule. */
export const FORMATTER_DECORATOR_NAME = "Formatter";

/** A language's grammar: the module and entry rule documents parse with. */
export type LanguageGrammar = {
  moduleUrl: URL;
  entryRuleName: string;
  /** In-memory modules resolved before compiled artifacts. */
  declarations?: Record<string, ModuleDeclaration>;
};

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

export enum FormatterResolutionKind {
  Found = "found",
  NoFormatter = "noFormatter",
  Unresolved = "unresolved",
}

export type FormatterResolution =
  | { kind: FormatterResolutionKind.Found; formatter: RuleInfo }
  | { kind: FormatterResolutionKind.NoFormatter }
  | { kind: FormatterResolutionKind.Unresolved; match: Match };

function isRuleInfo(value: unknown): value is RuleInfo {
  const [t, v] = type(value);
  switch (t) {
    case Type.Object:
      return v.kind === "rule" && type(v.name)[0] === Type.String &&
        type(v.moduleUrl)[0] === Type.String;
    default:
      return false;
  }
}

/**
 * The formatter a language's entry rule names with `[Formatter X]`; see
 * `.agents/specifications/languages/cli/editor-metadata.spec.md`.
 */
export async function resolveFormatter(
  grammar: LanguageGrammar,
): Promise<FormatterResolution> {
  const { moduleUrl, entryRuleName, declarations } = grammar;
  const resolved = await resolveGrammarModule({
    moduleUrl,
    entryRuleName,
    grammarOptions: { declarations },
  });
  if (!resolved.ok) {
    return { kind: FormatterResolutionKind.Unresolved, match: resolved.error };
  }
  const rule = resolved.resolved.module.rules.get(entryRuleName);
  const formatter = rule?.metadata?.[FORMATTER_DECORATOR_NAME];
  return isRuleInfo(formatter)
    ? { kind: FormatterResolutionKind.Found, formatter }
    : { kind: FormatterResolutionKind.NoFormatter };
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
      case FormatterResolutionKind.NoFormatter:
        return { kind: FormatResultKind.NoFormatter };
      case FormatterResolutionKind.Unresolved:
        return { kind: FormatResultKind.Unresolved, match: resolution.match };
    }
    formatter = resolution.formatter;
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
