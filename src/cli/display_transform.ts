import { type Match, MatchKind } from "../match.ts";
import { type HighlightResult, HighlightRole } from "./highlight.ts";

/**
 * Shared structured-result-to-markup transform for the session display
 * surface tool (see
 * `.agents/requirements/mcp-server/011-session-display-surface-tool.requirement.md`).
 *
 * Both a retained match result tree (evaluation/walk tools) and a
 * source-highlighting result (highlight tool) are first converted into this
 * one intermediate `DisplayNode` tree shape, then rendered to HTML by a
 * single `renderDisplayHtml` — so the two views cannot silently drift from
 * each other's markup/styling conventions.
 */
export type DisplayNode = {
  /** Human-readable label for this node (rule name, span text, ...). */
  label: string;
  /** CSS class identifying this node's role/kind for styling. */
  cssClass: string;
  /** Optional tooltip with additional detail (span offsets, metadata, ...). */
  title?: string;
  /** Child nodes, for tree-shaped results. Omitted/empty for a leaf. */
  children?: DisplayNode[];
};

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Renders a `DisplayNode` tree/list to a self-contained HTML fragment. */
export function renderDisplayHtml(nodes: DisplayNode[]): string {
  function renderNode(node: DisplayNode): string {
    const titleAttr = node.title !== undefined
      ? ` title="${escapeHtml(node.title)}"`
      : "";
    if (!node.children || node.children.length === 0) {
      return `<span class="${node.cssClass}"${titleAttr}>${
        escapeHtml(node.label)
      }</span>`;
    }
    const childrenHtml = node.children.map(renderNode).join("");
    return `<div class="node ${node.cssClass}"${titleAttr}>` +
      `<div class="node-label">${escapeHtml(node.label)}</div>` +
      `<div class="node-children">${childrenHtml}</div></div>`;
  }
  return nodes.map(renderNode).join("");
}

const HIGHLIGHT_CSS_CLASS: Record<HighlightRole, string> = {
  [HighlightRole.Keyword]: "hl-keyword",
  [HighlightRole.Identifier]: "hl-identifier",
  [HighlightRole.String]: "hl-string",
  [HighlightRole.Comment]: "hl-comment",
  [HighlightRole.Punctuation]: "hl-punctuation",
  [HighlightRole.Whitespace]: "hl-whitespace",
  [HighlightRole.NewLine]: "hl-newline",
};

/**
 * Converts a source-highlighting result (see `highlight.ts`) into a flat
 * list of leaf `DisplayNode`s, one per span, in source order.
 */
export function highlightResultToDisplayNodes(
  result: HighlightResult,
): DisplayNode[] {
  return result.spans.map((span) => ({
    label: span.text,
    cssClass: HIGHLIGHT_CSS_CLASS[span.role],
    title: `${span.role} [${span.offset}, ${span.offset + span.length})`,
  }));
}

const MATCH_KIND_CSS_CLASS: Record<MatchKind, string> = {
  [MatchKind.Ok]: "match-ok",
  [MatchKind.Fail]: "match-fail",
  [MatchKind.Error]: "match-error",
  [MatchKind.LR]: "match-lr",
};

/** Safety cap on total nodes converted from a single match tree, so a
 * pathologically large retained tree can't hang rendering or produce an
 * unusably huge HTML document. Unlike the walk tool's bounded windows (which
 * exist because MCP tool-call responses have a size budget), this is a
 * best-effort backstop for a human-scrollable page, not a pagination
 * contract. */
const MAX_MATCH_DISPLAY_NODES = 5000;

/**
 * Converts a retained match result tree (see
 * `RuntimeSession.getMatchResult`) into a `DisplayNode` tree, one node per
 * `Match`, labeled with its originating rule name (when known) and match
 * kind. Truncates (rather than hanging or OOMing) beyond
 * `MAX_MATCH_DISPLAY_NODES`.
 */
export function matchResultToDisplayNodes(root: Match): DisplayNode[] {
  let count = 0;

  function convert(node: Match): DisplayNode {
    count++;
    const isOkOrFail = node.kind === MatchKind.Ok ||
      node.kind === MatchKind.Fail;
    const ruleName = isOkOrFail ? node.origin?.rule.name : undefined;
    const label = ruleName ?? node.kind;
    const spanInfo = isOkOrFail
      ? ` [${node.originalSpan.start}, ${node.originalSpan.end})`
      : "";
    const cssClass = MATCH_KIND_CSS_CLASS[node.kind];

    if (!isOkOrFail) {
      return { label: `${label}${spanInfo}`, cssClass };
    }
    if (count >= MAX_MATCH_DISPLAY_NODES) {
      return {
        label: `${label}${spanInfo}`,
        cssClass,
        children: [{ label: "(truncated)", cssClass: "truncated" }],
      };
    }
    const children = node.matches
      .filter(() => count < MAX_MATCH_DISPLAY_NODES)
      .map(convert);
    return {
      label: `${label}${spanInfo}`,
      cssClass,
      children: children.length > 0 ? children : undefined,
    };
  }

  return [convert(root)];
}
