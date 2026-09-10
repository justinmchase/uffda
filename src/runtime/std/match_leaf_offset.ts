import type { MatchOk } from "../../match.ts";
import { markMatchAware } from "./match_aware.ts";

/**
 * Leaf numeric segment of the current match span.
 * Match-aware: invocation injects MatchOk as the first argument.
 * Authors write `(match_leaf_offset "start")` or `(match_leaf_offset "end")`.
 */
export const match_leaf_offset = markMatchAware(
  function match_leaf_offset(
    match: MatchOk,
    edge: "start" | "end",
  ): number {
    if (edge !== "start" && edge !== "end") {
      throw new TypeError('match_leaf_offset expects "start" or "end"');
    }
    const offset = match.span[edge].segments.at(-1);
    if (typeof offset !== "number") {
      throw new TypeError(`Expected numeric source ${edge} offset`);
    }
    return offset;
  },
);
