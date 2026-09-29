import { Type, type } from "@justinmchase/type";
import {
  getRightmostFailure,
  isSuccess,
  type Match,
  MatchKind,
} from "../match.ts";
import {
  EditorDecorator,
  editorMetadata,
  walkAccepted,
} from "./editor_metadata.ts";
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
 *    innermost annotated `Ok` nodes are the token spans, unless they span
 *    several other tokens (see `collectSpans`).
 * 2. A span's role is that of the largest annotated construct covering it,
 *    so words inside a quoted string or the tokens of a character class (both
 *    annotated `string`) classify as string content.
 * 3. Keyword classification is driven by `[Keyword]` metadata (see
 *    `src/lang/editor/editor.uff`), applied to every reserved-word rule of
 *    the module, pattern, and expression grammars, resolved the same way the
 *    match-tree walking tool (008) resolves metadata: any origin on the path
 *    from the tree's root carrying a `Keyword` metadata entry marks that
 *    span's matched range as a keyword, overriding the token's own role
 *    (but not a role inherited from an enclosing `Highlight`).
 */
export enum HighlightRole {
  Keyword = "keyword",
  Identifier = "identifier",
  String = "string",
  Comment = "comment",
  Punctuation = "punctuation",
  Whitespace = "whitespace",
  NewLine = "newline",
  Type = "type",
  Function = "function",
  Variable = "variable",
  Property = "property",
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

const NAME_REFINEMENT_ROLES: ReadonlySet<HighlightRole> = new Set([
  HighlightRole.Type,
  HighlightRole.Function,
  HighlightRole.Variable,
  HighlightRole.Property,
]);

/**
 * Whether `role` refines what an `identifier` names (a type, function,
 * variable, or property). Nodes annotated with one are not tokens: they
 * reclassify the `identifier` tokens within their span.
 */
export function isNameRefinementRole(role: HighlightRole): boolean {
  return NAME_REFINEMENT_ROLES.has(role);
}

/** Whether `role` classifies a name: `identifier` or a refinement of it. */
export function isNameRole(role: HighlightRole): boolean {
  return role === HighlightRole.Identifier || isNameRefinementRole(role);
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

type AnnotatedSpan = {
  start: number;
  end: number;
  role: HighlightRole;
};

type CollectedToken = {
  offset: number;
  length: number;
  text: string;
  /** The token's own `Highlight` role. */
  role: HighlightRole;
  /** Outermost `Highlight`-annotated tree ancestor, if any. */
  ancestor?: AnnotatedSpan;
  /** Role of the largest annotated span covering the token, if any. */
  inheritedRole?: HighlightRole;
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
 * before failing), collecting token spans and keyword-metadata spans. The
 * tree is a DAG (memoized sub-matches are shared by every attempt that
 * reached them), so each node is walked only on the first path reaching it;
 * spans are deduplicated keeping the first pre-order visit anyway (see
 * `highlightSpansFromMatch`), so later paths contribute nothing.
 *
 * A token span is an `Ok` node carrying `Highlight` metadata with no annotated
 * `Ok` descendant, unless its source span strictly contains another such
 * node's span: a parse-level construct built from several tokens (a pattern
 * character class `\cZs` spans the tokens `\` and `cZs`) is not a token
 * itself. Every annotated node that is not a token is a container. A token's
 * role is that of the largest container that is its tree ancestor or strictly
 * contains its span (so a string literal's inner words classify as string
 * content, and so do the tokens of a character class).
 */
function collectSpans(
  root: Match,
  sourceText: string,
): { tokens: CollectedToken[]; keywords: CollectedKeyword[] } {
  const leaves: CollectedToken[] = [];
  const containers: AnnotatedSpan[] = [];
  const keywords: CollectedKeyword[] = [];
  const emittedBy = new Map<Match, boolean>();

  /** Returns whether `node`'s subtree contributed a leaf. */
  function walk(node: Match, ancestor: AnnotatedSpan | undefined): boolean {
    const known = emittedBy.get(node);
    if (known !== undefined) return known;
    const emitted = walkOnce(node, ancestor);
    emittedBy.set(node, emitted);
    return emitted;
  }

  function walkOnce(node: Match, ancestor: AnnotatedSpan | undefined): boolean {
    if (!isSuccess(node) && node.kind !== MatchKind.Fail) {
      return false;
    }

    if (node.origin?.rule.metadata?.[KEYWORD_DECORATOR_NAME] !== undefined) {
      const { start, end } = node.originalSpan;
      if (isNonEmptySpan(start, end - start)) {
        keywords.push({ offset: start, length: end - start });
      }
    }

    const ownRole = highlightRoleOf(node);
    const { start, end } = node.originalSpan;
    const annotated = ownRole !== undefined &&
      !isNameRefinementRole(ownRole) && isSuccess(node) &&
      isNonEmptySpan(start, end - start);
    const self = annotated ? { start, end, role: ownRole } : undefined;
    let emitted = false;
    for (const child of node.matches) {
      if (walk(child, ancestor ?? self)) emitted = true;
    }
    if (!self) return emitted;
    if (emitted) {
      containers.push(self);
      return true;
    }
    leaves.push({
      offset: start,
      length: end - start,
      text: sourceText.slice(start, end),
      role: self.role,
      ancestor,
    });
    return true;
  }

  walk(root, undefined);

  const demoted = new Set(leavesContainingAnother(leaves));
  for (const leaf of demoted) {
    containers.push({
      start: leaf.offset,
      end: leaf.offset + leaf.length,
      role: leaf.role,
    });
  }
  const tokens = leaves.filter((leaf) => !demoted.has(leaf));
  assignInheritedRoles(tokens, containers);
  return { tokens, keywords };
}

/** Leaves whose span strictly contains another leaf's span. */
function leavesContainingAnother(
  leaves: readonly CollectedToken[],
): CollectedToken[] {
  const sorted = [...leaves].sort((a, b) =>
    a.offset - b.offset || b.length - a.length
  );
  const found: CollectedToken[] = [];
  for (let i = 0; i < sorted.length; i++) {
    const leaf = sorted[i];
    const end = leaf.offset + leaf.length;
    for (let j = i + 1; j < sorted.length && sorted[j].offset < end; j++) {
      const other = sorted[j];
      if (other.offset + other.length <= end && other.length < leaf.length) {
        found.push(leaf);
        break;
      }
    }
  }
  return found;
}

/**
 * Sets each token's `inheritedRole` from the largest of its outermost
 * annotated tree ancestor and the containers strictly containing its span
 * (on equal extent the ancestor, then the earliest-starting container, wins).
 */
function assignInheritedRoles(
  tokens: CollectedToken[],
  containers: AnnotatedSpan[],
): void {
  const byStart = [...containers].sort((a, b) => a.start - b.start);
  const ordered = [...tokens].sort((a, b) => a.offset - b.offset);
  let next = 0;
  let active: AnnotatedSpan[] = [];
  for (const token of ordered) {
    const end = token.offset + token.length;
    while (next < byStart.length && byStart[next].start <= token.offset) {
      active.push(byStart[next++]);
    }
    active = active.filter((container) => container.end > token.offset);

    let best = token.ancestor;
    let bestLength = best ? best.end - best.start : token.length;
    for (const container of active) {
      const length = container.end - container.start;
      if (container.end >= end && length > bestLength) {
        best = container;
        bestLength = length;
      }
    }
    token.inheritedRole = best?.role;
  }
}

function roleFor(
  token: CollectedToken,
  keywords: CollectedKeyword[],
): HighlightRole {
  if (token.inheritedRole !== undefined) return token.inheritedRole;
  const isKeyword = keywords.some(
    (k) => k.offset === token.offset && k.length === token.length,
  );
  return isKeyword ? HighlightRole.Keyword : token.role;
}

/**
 * The name-refinement-annotated `Ok` nodes of the accepted parse with no such
 * ancestor (the outermost on their path; see `walkAccepted`).
 */
function collectNameRefinements(root: Match): AnnotatedSpan[] {
  const refinements: AnnotatedSpan[] = [];
  walkAccepted(root, (node, ancestors) => {
    if (!isSuccess(node)) return;
    const role = highlightRoleOf(node);
    if (role === undefined || !isNameRefinementRole(role)) return;
    const nested = ancestors.some((ancestor) => {
      if (!isSuccess(ancestor)) return false;
      const outer = highlightRoleOf(ancestor);
      return outer !== undefined && isNameRefinementRole(outer);
    });
    const { start, end } = node.originalSpan;
    if (!nested && isNonEmptySpan(start, end - start)) {
      refinements.push({ start, end, role });
    }
  });
  return refinements;
}

/**
 * Reclassifies each `identifier` span within a refinement's span with the
 * refinement's role, the first refinement covering a span winning.
 */
function refineNames(
  spans: HighlightSpan[],
  refinements: readonly AnnotatedSpan[],
): void {
  const names = spans.filter((span) => span.role === HighlightRole.Identifier);
  const refined = new Set<HighlightSpan>();
  for (const { start, end, role } of refinements) {
    let lo = 0;
    let hi = names.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (names[mid].offset < start) lo = mid + 1;
      else hi = mid;
    }
    for (let i = lo; i < names.length && names[i].offset < end; i++) {
      const span = names[i];
      if (span.offset + span.length > end || refined.has(span)) continue;
      span.role = role;
      refined.add(span);
    }
  }
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
  refineNames(spans, collectNameRefinements(root));
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
  if (isSuccess(match)) return { ok: true, spans };

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
  [HighlightRole.Type]: "\x1b[96m", // bright cyan
  [HighlightRole.Function]: "\x1b[33m", // yellow
  [HighlightRole.Variable]: "\x1b[94m", // bright blue
  [HighlightRole.Property]: "\x1b[34m", // blue
};
const ANSI_RESET = "\x1b[0m";

/** Renders `spans` as ANSI-annotated text, suitable for direct display. */
export function renderHighlightAnsi(spans: HighlightSpan[]): string {
  return spans
    .map((span) => `${ANSI_CODES[span.role]}${span.text}${ANSI_RESET}`)
    .join("");
}
