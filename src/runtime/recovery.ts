import {
  isRecovered,
  type Match,
  type MatchFail,
  MatchKind,
  type MatchSuccess,
} from "../match.ts";
import { andThen, type AwaitableMatch } from "./awaitable.ts";
import { match } from "./match.ts";
import type { Pattern } from "./patterns/pattern.ts";
import { PatternKind } from "./patterns/pattern.kind.ts";
import type { Scope } from "./scope.ts";

/**
 * Matches `pattern` in two phases (see
 * `.agents/specifications/runtime/error-recovery.spec.md#two-phase-matching`):
 * first with recovery disabled, exactly as {@link match} would; then, only
 * when that fails after reaching a recovery point, again from the same
 * position with recovery enabled.
 */
export function matchWithRecovery(
  pattern: Pattern,
  scope: Scope,
): AwaitableMatch {
  const discovery = scope.withRecovery(false);
  return andThen(
    match(pattern, discovery),
    (discovered) =>
      discovered.kind === MatchKind.Fail && discovery.memos.recoverable
        ? match(pattern, scope.withRecovery(true))
        : discovered,
  );
}

/** One recovery in a parse: the `recover` match and the failure it replaced. */
export type Recovery = {
  match: MatchSuccess;
  failure: MatchFail;
};

/**
 * The recoveries of the accepted parse under `root` (successes beneath
 * successes, and everything beneath a `Fail` root), in document order, each
 * once.
 */
export function collectRecoveries(root: Match): Recovery[] {
  const recoveries: Recovery[] = [];
  if (!root.scope.recovery) return recoveries;
  const visited = new Set<Match>();
  const visit = (node: Match): void => {
    if (visited.has(node)) return;
    visited.add(node);
    switch (node.kind) {
      case MatchKind.Ok:
      case MatchKind.Skip: {
        const [failure] = node.matches;
        if (
          node.pattern.kind === PatternKind.Recover &&
          failure?.kind === MatchKind.Fail
        ) {
          recoveries.push({ match: node, failure });
        }
        for (const child of node.matches) {
          if (isRecovered(child)) visit(child);
        }
        return;
      }
      case MatchKind.Fail:
        for (const child of node.matches) visit(child);
        return;
    }
  };
  visit(root);
  return recoveries;
}
