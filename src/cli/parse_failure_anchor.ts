import type { Match } from "../match.ts";
import { HighlightRole, highlightSpansFromMatch } from "./highlight.ts";
import { type CliStreamFailureLocation, locationFromOffset } from "./stream.ts";

const TRIVIA_ROLES = new Set([
  HighlightRole.Whitespace,
  HighlightRole.NewLine,
  HighlightRole.Comment,
]);

/**
 * Re-anchors a parse failure onto the end of the construct left incomplete.
 *
 * A failure reports where the unexpected token is. When a line break (only
 * trivia) separates it from the last significant token before it, the
 * problem is that the earlier line is unfinished (`import "./a.uff"` missing
 * its names), so the failure is reported as a zero-width point right after
 * that token rather than on an unrelated later line. Trivia is classified
 * from `match`'s own token spans (see `highlightSpansFromMatch`). Returns
 * `location` unchanged when no line break intervenes.
 */
export function anchorParseFailureLocation(
  match: Match,
  source: string,
  location: CliStreamFailureLocation,
): CliStreamFailureLocation {
  let previousEnd: number | undefined;
  for (const span of highlightSpansFromMatch(match, source)) {
    const end = span.offset + span.length;
    if (end > location.offset) break;
    if (!TRIVIA_ROLES.has(span.role)) previousEnd = end;
  }
  if (previousEnd === undefined) return location;
  if (!source.slice(previousEnd, location.offset).includes("\n")) {
    return location;
  }
  return { ...locationFromOffset(source, previousEnd), endOffset: previousEnd };
}
