import { Type, type } from "@justinmchase/type";
import { getRightmostFailure, type Match, MatchKind } from "../match.ts";
import { EditorDecorator, editorMetadata } from "./editor_metadata.ts";
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
 * Classification reads only rule metadata off the `Match` tree already
 * produced by parsing (no second pass over the text, no rule names):
 *
 * 1. Token rules carry `[Highlight { role }]` (see `src/lang/editor/editor.uff`
 *    and `.agents/specifications/languages/cli/editor-metadata.spec.md`). The
 *    innermost annotated `Ok` nodes are the token spans.
 * 2. A span's role is that of the outermost `Highlight` on its path, so words
 *    and whitespace reused inside a quoted string (itself annotated
 *    `string`) classify as string content.
 * 3. Keyword classification is driven by decorator metadata (a `[Keyword]`
 *    decorator applied to the Uffda module grammar's own reserved-word rules,
 *    see `src/lang/uffda/shared.rules.uff`) resolved the same way the
 *    match-tree walking tool (008) resolves metadata: any origin on the path
 *    from the tree's root carrying a `Keyword` metadata entry marks that
 *    span's matched range as a keyword, overriding the token's own role
 *    (but not a role inherited from an enclosing `Highlight`).
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

const HIGHLIGHT_ROLES: ReadonlySet<string> = new Set(
  Object.values(HighlightRole),
);

const TRIVIA_ROLES: ReadonlySet<HighlightRole> = new Set([
  HighlightRole.Whitespace,
  HighlightRole.NewLine,
  HighlightRole.Comment,
]);

/** Whether `role` marks trivia (whitespace, line breaks, comments). */
export function isTriviaRole(role: HighlightRole): boolean {
  return TRIVIA_ROLES.has(role);
}

/**
 * The role a node's `[Highlight { role }]` metadata declares, if any.
 * Unrecognized roles are ignored rather than trusted.
 */
export function highlightRoleOf(node: Match): HighlightRole | undefined {
  const [t, v] = type(editorMetadata(node, EditorDecorator.Highlight));
  if (t !== Type.Object) return undefined;
  const role = (v as { role?: unknown }).role;
  return type(role)[0] === Type.String && HIGHLIGHT_ROLES.has(role as string)
    ? role as HighlightRole
    : undefined;
}

const KEYWORD_DECORATOR_NAME = "Keyword";

type CollectedToken = {
  offset: number;
  length: number;
  text: string;
  /** Role of the outermost `Highlight` on the token's path. */
  role: HighlightRole;
  /** Whether that role came from an enclosing annotated node. */
  inherited: boolean;
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
 * token span is an `Ok` node carrying `Highlight` metadata with no annotated
 * `Ok` descendant; its role is that of the outermost `Highlight` on its path
 * (so a string literal's inner words classify as string content).
 */
function collectSpans(
  root: Match,
  sourceText: string,
): { tokens: CollectedToken[]; keywords: CollectedKeyword[] } {
  const tokens: CollectedToken[] = [];
  const keywords: CollectedKeyword[] = [];

  /** Returns whether `node`'s subtree contributed a token span. */
  function walk(node: Match, outerRole: HighlightRole | undefined): boolean {
    if (node.kind !== MatchKind.Ok && node.kind !== MatchKind.Fail) {
      return false;
    }

    if (node.origin?.rule.metadata?.[KEYWORD_DECORATOR_NAME] !== undefined) {
      const { start, end } = node.originalSpan;
      if (isNonEmptySpan(start, end - start)) {
        keywords.push({ offset: start, length: end - start });
      }
    }

    const ownRole = highlightRoleOf(node);
    let emitted = false;
    for (const child of node.matches) {
      if (walk(child, outerRole ?? ownRole)) emitted = true;
    }
    if (emitted) return true;
    if (ownRole === undefined || node.kind !== MatchKind.Ok) return false;

    const { start, end } = node.originalSpan;
    if (!isNonEmptySpan(start, end - start)) return false;
    tokens.push({
      offset: start,
      length: end - start,
      text: sourceText.slice(start, end),
      role: outerRole ?? ownRole,
      inherited: outerRole !== undefined,
    });
    return true;
  }

  walk(root, undefined);
  return { tokens, keywords };
}

function roleFor(
  token: CollectedToken,
  keywords: CollectedKeyword[],
): HighlightRole {
  if (token.inherited) return token.role;
  const isKeyword = keywords.some(
    (k) => k.offset === token.offset && k.length === token.length,
  );
  return isKeyword ? HighlightRole.Keyword : token.role;
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
