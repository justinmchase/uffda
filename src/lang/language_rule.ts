import { Type, type } from "@justinmchase/type";
import { resolveGrammarModule } from "./grammar.ts";
import type { ModuleDeclaration } from "../runtime/declarations/module.ts";
import type { Match } from "../match.ts";
import type { RuleInfo } from "../runtime/modules/rule_info.ts";

/** A language's grammar: the module and entry rule documents parse with. */
export type LanguageGrammar = {
  moduleUrl: URL;
  entryRuleName: string;
  /** In-memory modules resolved before compiled artifacts. */
  declarations?: Record<string, ModuleDeclaration>;
};

export enum LanguageRuleResolutionKind {
  /** The entry rule names a rule with the decorator. */
  Found = "found",
  /** The entry rule has no such decorator. */
  Missing = "missing",
  /** The language's grammar could not be resolved. */
  Unresolved = "unresolved",
}

export type LanguageRuleResolution =
  | { kind: LanguageRuleResolutionKind.Found; rule: RuleInfo }
  | { kind: LanguageRuleResolutionKind.Missing }
  | { kind: LanguageRuleResolutionKind.Unresolved; match: Match };

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
 * The rule a language's entry rule names with `[decoratorName X]`, such as
 * `[Formatter X]` or `[ToggleComment X]`; see
 * `.agents/specifications/languages/cli/editor-metadata.spec.md`.
 */
export async function resolveLanguageRule(
  grammar: LanguageGrammar,
  decoratorName: string,
): Promise<LanguageRuleResolution> {
  const { moduleUrl, entryRuleName, declarations } = grammar;
  const resolved = await resolveGrammarModule({
    moduleUrl,
    entryRuleName,
    grammarOptions: { declarations },
  });
  if (!resolved.ok) {
    return {
      kind: LanguageRuleResolutionKind.Unresolved,
      match: resolved.error,
    };
  }
  const entry = resolved.resolved.module.rules.get(entryRuleName);
  const rule = entry?.metadata?.[decoratorName];
  return isRuleInfo(rule)
    ? { kind: LanguageRuleResolutionKind.Found, rule }
    : { kind: LanguageRuleResolutionKind.Missing };
}
