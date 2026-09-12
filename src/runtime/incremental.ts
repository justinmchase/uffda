import { Memos } from "../memo.ts";
import { MatchKind } from "../match.ts";
import { canSkipMemo } from "./rule.reentrancy.ts";
import type { Match } from "../match.ts";
import type { Edit } from "../edit.ts";
import type { Input } from "../input.ts";
import type { Path } from "../path.ts";

/**
 * Rehydrates a fresh {@link Memos} table from a prior parse's delivered
 * `Match` tree, reusing every rule-boundary match that lies entirely before
 * `edit.at` — the start of the affected region — against a freshly-built
 * `Input` chain over the post-edit sequence.
 *
 * This exists because proof-driven memo eviction (see
 * `.agents/specifications/runtime/memo-eviction.spec.md`) clears the memo
 * table itself the moment a parse completes: only the delivered result tree
 * survives, via ordinary JS reachability. Incremental re-parsing (see
 * `.agents/specifications/runtime/incremental-parsing.spec.md`) therefore
 * cannot reuse a surviving `Memos` instance — it must reconstruct one from
 * that tree, keyed by the `MatchOrigin` (`rule` + resolved `args`) each
 * fresh rule invocation stamps onto its own result (see `rule()` in
 * `./rule.ts`).
 *
 * Algorithm (see `.agents/specifications/runtime/incremental-parsing.spec.md`
 * and this session's design discussion for the full rationale):
 *  1. Walk the fresh, post-edit `Input` forward from position 0 up to and
 *     including `edit.at`, indexing every position reached by its
 *     `path.toString()`. This is cheap: no grammar evaluation occurs, only
 *     plain iteration of the (possibly lazy) input sequence.
 *  2. Walk the prior delivered `Match` tree. Any `Ok`/`Fail` node that both
 *     carries an `origin` (was produced by a fresh rule invocation, not a
 *     memo-hit wrapper or a non-rule-boundary combinator) and whose
 *     `span.end` is at or before `edit.at` is entirely unaffected by the
 *     edit: its content, matched value, and nested structure are byte-
 *     identical between the old and new sequences by definition. Such a
 *     node is inserted into the fresh `Memos` table under its own
 *     `(origin.rule, origin.args, span.start)` key, with only its own
 *     `scope.stream` swapped for the corresponding fresh `Input` node (so
 *     that a caller resuming from this memoized result continues walking
 *     the *new* sequence rather than the stale one). A node whose rule is
 *     proven safe to skip memoization for entirely (see
 *     `./rule.reentrancy.ts` and
 *     `.agents/specifications/runtime/selective-memoization.spec.md`) is
 *     never captured either: such a rule never consults `scope.memos` in
 *     the first place, so an entry for it would just be dead weight. Its
 *     invocations are simply recomputed directly on the rehydrated
 *     re-parse — safe, and inexpensive by construction, since that
 *     analysis only applies to rules cheap enough to not need reuse.
 *  3. Recursion stops the moment such a node is captured: a memo hit at
 *     this node's position will short-circuit before a fresh parse ever
 *     queries any of its descendants, so indexing them too would be pure
 *     waste (see the "captured node" note below).
 *  4. Nodes that are not themselves reusable (no `origin`, or a span
 *     crossing into/after the affected region) are still walked through —
 *     never captured directly, but visited so any reusable descendants
 *     nested within them are still found.
 *
 * Only positions strictly before `edit.at` are ever reused; this function
 * makes no attempt to remap or reuse matches that start within or after the
 * affected region (v1 scope).
 */
export async function rehydrateMemos(
  priorMatch: Match,
  edit: Edit,
  freshInput: Input,
): Promise<Memos> {
  const memos = new Memos();
  const positions = await buildPositionIndex(freshInput, edit.at);

  const visit = (node: Match): void => {
    if (node.kind !== MatchKind.Ok && node.kind !== MatchKind.Fail) {
      return;
    }

    if (
      node.origin &&
      node.span.end.compareTo(edit.at) <= 0 &&
      !canSkipMemo(node.origin.rule)
    ) {
      const freshEnd = positions.get(node.span.end.toString());
      if (freshEnd) {
        const { key } = memos.resolve(
          node.span.start,
          node.origin.rule,
          [...node.origin.args.values()],
        );
        memos.set(node.span.start, key, {
          ...node,
          scope: node.scope.withInput(freshEnd),
        });
        // Captured: a memo hit here will short-circuit before a fresh parse
        // ever visits this node's descendants, so there is no value in
        // indexing them too.
        return;
      }
    }

    for (const child of node.matches) {
      visit(child);
    }
  };

  visit(priorMatch);
  return memos;
}

/**
 * Walks `input` forward from its current position, recording every position
 * reached (by `path.toString()`) until a position at or past `limit` is
 * recorded (inclusive), or the input is exhausted first.
 */
async function buildPositionIndex(
  input: Input,
  limit: Path,
): Promise<Map<string, Input>> {
  const positions = new Map<string, Input>();
  let current = input;
  positions.set(current.path.toString(), current);
  while (current.path.compareTo(limit) < 0 && !(await current.done())) {
    current = await current.next();
    positions.set(current.path.toString(), current);
  }
  return positions;
}
