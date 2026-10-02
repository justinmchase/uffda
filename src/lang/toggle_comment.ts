import { Type, type } from "@justinmchase/type";
import { parseGrammar } from "./grammar.ts";
import {
  type LanguageGrammar,
  type LanguageRuleResolution,
  LanguageRuleResolutionKind,
  resolveLanguageRule,
} from "./language_rule.ts";
import { isClean, type Match, MatchKind, valueOf } from "../match.ts";
import type { RuleInfo } from "../runtime/modules/rule_info.ts";
import { unwrap } from "../wrapped.ts";

/** The decorator naming a language's comment toggle on its entry rule. */
export const TOGGLE_COMMENT_DECORATOR_NAME = "ToggleComment";

export enum ToggleCommentResultKind {
  /** The lines were toggled. */
  Toggled = "toggled",
  /** The language's entry rule has no `[ToggleComment]`. */
  NoToggleComment = "noToggleComment",
  /** The language's grammar could not be resolved. */
  Unresolved = "unresolved",
  /** The toggle rule failed, or produced something other than text. */
  ToggleFailed = "toggleFailed",
}

export type ToggleCommentResult =
  | { kind: ToggleCommentResultKind.Toggled; text: string }
  | { kind: ToggleCommentResultKind.NoToggleComment }
  | { kind: ToggleCommentResultKind.Unresolved; match: Match }
  | {
    kind: ToggleCommentResultKind.ToggleFailed;
    match: Match;
    message: string;
  };

/**
 * The comment toggle a language's entry rule names with `[ToggleComment X]`;
 * see `.agents/specifications/languages/cli/editor-metadata.spec.md`.
 */
export function resolveToggleComment(
  grammar: LanguageGrammar,
): Promise<LanguageRuleResolution> {
  return resolveLanguageRule(grammar, TOGGLE_COMMENT_DECORATOR_NAME);
}

/**
 * Toggles comments on `text`, the text of whole lines, with the rule the
 * language names with `[ToggleComment]`. The rule receives the text as its
 * input and produces the replacement text.
 */
export async function toggleComment(
  grammar: LanguageGrammar,
  text: string,
): Promise<ToggleCommentResult> {
  const resolution = await resolveToggleComment(grammar);
  switch (resolution.kind) {
    case LanguageRuleResolutionKind.Missing:
      return { kind: ToggleCommentResultKind.NoToggleComment };
    case LanguageRuleResolutionKind.Unresolved:
      return {
        kind: ToggleCommentResultKind.Unresolved,
        match: resolution.match,
      };
  }
  return await toggleWith(resolution.rule, text, grammar);
}

async function toggleWith(
  rule: RuleInfo,
  text: string,
  grammar: LanguageGrammar,
): Promise<ToggleCommentResult> {
  const match = await parseGrammar<string>({
    source: text,
    moduleUrl: new URL(rule.moduleUrl),
    entryRuleName: rule.name,
    grammarOptions: { declarations: grammar.declarations },
  });
  if (!isClean(match) || match.kind !== MatchKind.Ok) {
    return {
      kind: ToggleCommentResultKind.ToggleFailed,
      match,
      message: `comment toggle ${rule.name} did not match the lines`,
    };
  }
  const toggled = unwrap(valueOf(match));
  if (type(toggled)[0] !== Type.String) {
    return {
      kind: ToggleCommentResultKind.ToggleFailed,
      match,
      message: `comment toggle ${rule.name} did not produce text`,
    };
  }
  return { kind: ToggleCommentResultKind.Toggled, text: toggled as string };
}
