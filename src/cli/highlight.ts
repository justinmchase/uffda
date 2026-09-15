import { getRightmostFailure, type Match, MatchKind } from "../match.ts";
import { uffdaGrammar } from "../lang/uffda/uffda.lang.ts";
import { patternGrammar } from "../lang/pattern/pattern.lang.ts";
import { expressionGrammar } from "../lang/expression/expression.lang.ts";
import { CliLanguage } from "./contract.ts";
import {
  type CliStreamFailure,
  CliStreamFailureCode,
  locationFromOffset,
  parseFailureMessage,
} from "./stream.ts";

/**
 * Source-highlighting tool (see
 * `.agents/requirements/mcp-server/009-source-highlighting-tool.requirement.md`
 * and `mcp-server.spec.md#source-highlighting-tool`). Classifies spans of
 * Uffda (or a sub-language's) source text by syntactic role, derived from the
 * same parse/`Match` tree the rest of the CLI uses for diagnostics — not a
 * separately maintained regex/heuristic classifier.
 *
 * Two independent signals feed classification, both read directly off the
 * `Match` tree already produced by parsing (no second pass over the text):
 *
 * 1. Every grammar reuses the same `tokenizer/mod.uff` token rules
 *    (`WordToken`, `CommentToken`, `WhitespaceToken`, `NewLineToken`,
 *    `PunctuationToken`, `DQuoteToken`, `StringPunctuationToken`, escape
 *    tokens). A leaf `Match` whose `origin.rule.name` is one of these gives a
 *    base role for that span.
 * 2. `WordToken`/`WhitespaceToken`/`NewLineToken` are reused verbatim *inside*
 *    quoted strings (`StringInterior`), so base role alone can't tell "bare
 *    identifier" from "text inside a string" — that distinction comes from
 *    whether a `QuotedStringTokens`/`StringInterior` origin appears among the
 *    node's ancestors.
 * 3. Keyword classification is driven by decorator metadata (a `[Keyword]`
 *    decorator applied to the Uffda module grammar's own reserved-word rules,
 *    see `src/lang/uffda/shared.rules.uff`) resolved the same way the
 *    match-tree walking tool (008) resolves metadata: any origin on the path
 *    from the tree's root carrying a `Keyword` metadata entry marks that
 *    span's matched range as a keyword, overriding the base "identifier"
 *    role.
 *
 * Only the Uffda module grammar's reserved words (`import`/`export`/`rule`/
 * `func`/`decorator`) carry `[Keyword]` metadata today; the pattern/expression
 * sub-grammars' own keyword-like atoms (`any`, `switch`, `true`, ...) are a
 * deliberately deferred follow-up and currently classify as plain
 * identifiers.
 */
export enum HighlightRole {
  Keyword = "keyword",
  Identifier = "identifier",
  String = "string",
  Comment = "comment",
  Punctuation = "punctuation",
  Whitespace = "whitespace",
  NewLine = "newline",
}

export type HighlightSpan = {
  role: HighlightRole;
  offset: number;
  length: number;
  text: string;
};

export type HighlightResult =
  | { ok: true; spans: HighlightSpan[] }
  | { ok: false; error: CliStreamFailure; spans: HighlightSpan[] };

/** Rule names produced by `tokenizer/mod.uff`, and their base role. */
const TOKEN_RULE_ROLES: ReadonlyMap<string, HighlightRole> = new Map([
  ["WordToken", HighlightRole.Identifier],
  ["CommentToken", HighlightRole.Comment],
  ["WhitespaceToken", HighlightRole.Whitespace],
  ["NewLineToken", HighlightRole.NewLine],
  ["PunctuationToken", HighlightRole.Punctuation],
  ["DQuoteToken", HighlightRole.Punctuation],
  ["StringPunctuationToken", HighlightRole.String],
  ["SlashPunctuationToken", HighlightRole.Punctuation],
  ["EscapeCharPunctuationToken", HighlightRole.String],
]);

/** Rule names whose descendants are inside a quoted string's content. */
const STRING_ANCESTOR_RULE_NAMES = new Set([
  "QuotedStringTokens",
  "StringInterior",
]);

const KEYWORD_DECORATOR_NAME = "Keyword";

type CollectedToken = {
  offset: number;
  length: number;
  text: string;
  baseRole: HighlightRole;
  insideString: boolean;
};

type CollectedKeyword = {
  offset: number;
  length: number;
};

function isNonEmptySpan(offset: number, length: number): boolean {
  return length > 0 && Number.isFinite(offset) && Number.isFinite(length);
}

/**
 * Walks the entire `Match` tree once (pre-order, both `Ok` and `Fail`
 * branches — a `Fail` still has whatever `Ok` sub-matches it accumulated
 * before failing), collecting token spans and keyword-metadata spans. A
 * single pass suffices because both signals are read directly off `origin`,
 * not recomputed.
 */
function collectSpans(
  root: Match,
  sourceText: string,
): { tokens: CollectedToken[]; keywords: CollectedKeyword[] } {
  const tokens: CollectedToken[] = [];
  const keywords: CollectedKeyword[] = [];

  function walk(node: Match, stringAncestor: boolean): void {
    if (node.kind !== MatchKind.Ok && node.kind !== MatchKind.Fail) return;

    const ruleName = node.origin?.rule.name;
    const insideString = stringAncestor ||
      (ruleName !== undefined && STRING_ANCESTOR_RULE_NAMES.has(ruleName));

    if (node.origin?.rule.metadata?.[KEYWORD_DECORATOR_NAME] !== undefined) {
      const { start, end } = node.originalSpan;
      if (isNonEmptySpan(start, end - start)) {
        keywords.push({ offset: start, length: end - start });
      }
    }

    if (ruleName !== undefined) {
      const baseRole = TOKEN_RULE_ROLES.get(ruleName);
      if (baseRole !== undefined && node.kind === MatchKind.Ok) {
        const { start, end } = node.originalSpan;
        if (isNonEmptySpan(start, end - start)) {
          tokens.push({
            offset: start,
            length: end - start,
            text: sourceText.slice(start, end),
            baseRole,
            insideString,
          });
        }
      }
    }

    for (const child of node.matches) walk(child, insideString);
  }

  walk(root, false);
  return { tokens, keywords };
}

function roleFor(
  token: CollectedToken,
  keywords: CollectedKeyword[],
): HighlightRole {
  if (token.insideString) return HighlightRole.String;
  const tokenEnd = token.offset + token.length;
  // Keyword spans are read back from a rule invocation matched against the
  // whitespace/comment/newline-filtered token stream (`TokenizerNoWhitespace`
  // drops those trivia entirely before the module grammar sees it), so a
  // keyword's originalSpan can start earlier than the token it corresponds
  // to (absorbing filtered-out trivia between the previous surviving token
  // and this one). Its end always lines up exactly with the token's end, so
  // match on that rather than requiring an exact offset/length equality.
  const isKeyword = keywords.some(
    (k) => k.offset <= token.offset && k.offset + k.length === tokenEnd,
  );
  return isKeyword ? HighlightRole.Keyword : token.baseRole;
}

/**
 * Projects a parsed `Match` tree into a deterministic, gap-free ordered span
 * list covering `sourceText` in full. Overlapping/duplicate token spans
 * (e.g. the same characters visited more than once via memoized sub-trees)
 * are deduplicated by offset, keeping the first (leftmost pre-order) visit.
 *
 * Shared by `highlightSource` (MCP/CLI) and the LSP semantic-tokens path
 * (`src/cli/semantic_tokens.ts`) so both derive classifications from the
 * same parse tree rather than a second, highlighting-specific parse.
 */
export function highlightSpansFromMatch(
  root: Match,
  sourceText: string,
): HighlightSpan[] {
  const { tokens, keywords } = collectSpans(root, sourceText);

  const byOffset = new Map<number, CollectedToken>();
  for (const token of tokens) {
    if (!byOffset.has(token.offset)) byOffset.set(token.offset, token);
  }
  const ordered = [...byOffset.values()].sort((a, b) => a.offset - b.offset);

  const spans: HighlightSpan[] = [];
  let cursor = 0;
  for (const token of ordered) {
    if (token.offset < cursor) continue; // overlapping memoized re-visit
    if (token.offset > cursor) {
      // A gap the tokenizer didn't account for (should not normally happen);
      // still cover it rather than silently dropping characters.
      spans.push({
        role: HighlightRole.Punctuation,
        offset: cursor,
        length: token.offset - cursor,
        text: sourceText.slice(cursor, token.offset),
      });
    }
    spans.push({
      role: roleFor(token, keywords),
      offset: token.offset,
      length: token.length,
      text: token.text,
    });
    cursor = token.offset + token.length;
  }
  if (cursor < sourceText.length) {
    spans.push({
      role: HighlightRole.Punctuation,
      offset: cursor,
      length: sourceText.length - cursor,
      text: sourceText.slice(cursor),
    });
  }
  return spans;
}

export async function highlightSource(
  sourceText: string,
  language: CliLanguage = CliLanguage.FullUffda,
): Promise<HighlightResult> {
  const match = await (() => {
    switch (language) {
      case CliLanguage.FullUffda:
        return uffdaGrammar(sourceText);
      case CliLanguage.Pattern:
        return patternGrammar(sourceText);
      case CliLanguage.Expression:
        return expressionGrammar(sourceText);
    }
  })();

  const spans = highlightSpansFromMatch(match, sourceText);
  if (match.kind === MatchKind.Ok) return { ok: true, spans };

  const rightmost = match.kind === MatchKind.Fail
    ? getRightmostFailure(match)
    : match;
  const offset = rightmost.kind === MatchKind.LR ? sourceText.length : Math.max(
    0,
    Math.min(rightmost.originalSpan.start, sourceText.length),
  );
  return {
    ok: false,
    error: {
      code: CliStreamFailureCode.ParseFailure,
      phase: "parse",
      sourcePath: "<stdin>",
      language,
      message: await parseFailureMessage(match),
      location: locationFromOffset(sourceText, offset),
    },
    spans,
  };
}

const ANSI_CODES: Record<HighlightRole, string> = {
  [HighlightRole.Keyword]: "\x1b[35m", // magenta
  [HighlightRole.Identifier]: "\x1b[39m", // default
  [HighlightRole.String]: "\x1b[32m", // green
  [HighlightRole.Comment]: "\x1b[90m", // bright black / gray
  [HighlightRole.Punctuation]: "\x1b[36m", // cyan
  [HighlightRole.Whitespace]: "\x1b[39m",
  [HighlightRole.NewLine]: "\x1b[39m",
};
const ANSI_RESET = "\x1b[0m";

/** Renders `spans` as ANSI-annotated text, suitable for direct display. */
export function renderHighlightAnsi(spans: HighlightSpan[]): string {
  return spans
    .map((span) => `${ANSI_CODES[span.role]}${span.text}${ANSI_RESET}`)
    .join("");
}
