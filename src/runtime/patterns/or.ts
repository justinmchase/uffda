import { fail, forward, MatchKind } from "../../match.ts";
import type { Match, MatchSuccess } from "../../match.ts";
import type { Scope } from "../scope.ts";
import { compile } from "../match.ts";
import { eachInOrder } from "../awaitable.ts";
import type { CompiledPattern } from "../compiled_pattern.ts";
import type { OrPattern } from "./pattern.ts";

/**
 * Compiles an `Or` pattern into a flattened, reusable closure.
 *
 * With recovery enabled, a recovered alternative (see
 * `.agents/specifications/runtime/error-recovery.spec.md#ordered-choice`) is
 * chosen only when no later alternative succeeds without recovery. An
 * alternative passed over this way is retained as a rejected attempt: a
 * `Fail` of that alternative wrapping its success.
 */
export function or(pattern: OrPattern, scope: Scope): CompiledPattern {
  const { patterns } = pattern;
  const children = patterns.map((p) => compile(p, scope));

  const plain = (invocationScope: Scope) => {
    const matches: Match[] = [];
    return eachInOrder<Match, Match>(
      children.length,
      (i) => children[i](invocationScope),
      (_, m) => {
        matches.push(m);
        switch (m.kind) {
          case MatchKind.LR:
          case MatchKind.Error:
            return m;
          case MatchKind.Fail:
            return undefined;
          case MatchKind.Ok:
          case MatchKind.Skip:
            return forward(invocationScope, m.scope, pattern, m, matches);
        }
      },
      () => fail(invocationScope, pattern, matches),
    );
  };

  const recovering = (invocationScope: Scope) => {
    // One entry per attempted alternative, so an index names both.
    const matches: Match[] = [];
    let recovered: MatchSuccess | undefined;
    const reject = (i: number) =>
      fail(invocationScope, patterns[i], [matches[i]]);
    return eachInOrder<Match, Match>(
      children.length,
      (i) => children[i](invocationScope),
      (i, m) => {
        matches.push(m);
        switch (m.kind) {
          case MatchKind.LR:
          case MatchKind.Error:
            return m;
          case MatchKind.Fail:
            return undefined;
          case MatchKind.Ok:
          case MatchKind.Skip:
            if (m.recovered) {
              if (recovered) matches[i] = reject(i);
              else recovered = m;
              return undefined;
            }
            if (recovered) {
              const r = matches.indexOf(recovered);
              matches[r] = reject(r);
            }
            return forward(invocationScope, m.scope, pattern, m, matches);
        }
      },
      () =>
        recovered
          ? forward(
            invocationScope,
            recovered.scope,
            pattern,
            recovered,
            matches,
          )
          : fail(invocationScope, pattern, matches),
    );
  };

  return (invocationScope: Scope) =>
    invocationScope.recovery
      ? recovering(invocationScope)
      : plain(invocationScope);
}
