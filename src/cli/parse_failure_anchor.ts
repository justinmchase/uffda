import type { Match } from "../match.ts";
import {
  HighlightRole,
  highlightSpansFromMatch,
  isTriviaRole,
} from "./highlight.ts";
import { type CliStreamFailureLocation, locationFromOffset } from "./stream.ts";

/**
 * Re-anchors a parse failure onto the end of the construct left incomplete.
 *
 * A failure reports where the unexpected token is. When a line break (only
 * trivia) separates it from the last significant token before it, the
 * problem is that the earlier line is unfinished (`import "./a.uff"` missing
 * its names), so the failure is reported as a zero-width point right after
 * that token rather than on an unrelated later line. Trivia and line breaks
 * are classified from `match`'s own token spans (see
 * `highlightSpansFromMatch`). Returns `location` unchanged when no line break
 * intervenes.
 */
export function anchorParseFailureLocation(
  match: Match,
  source: string,
  location: CliStreamFailureLocation,
): CliStreamFailureLocation {
  let previousEnd: number | undefined;
  let lineBreak = false;
  for (const span of highlightSpansFromMatch(match, source)) {
    const end = span.offset + span.length;
    if (end > location.offset) break;
    if (!isTriviaRole(span.role)) {
      previousEnd = end;
      lineBreak = false;
    } else if (span.role === HighlightRole.NewLine) {
      lineBreak = true;
    }
  }
  if (previousEnd === undefined || !lineBreak) return location;
  return { ...locationFromOffset(source, previousEnd), endOffset: previousEnd };
}
