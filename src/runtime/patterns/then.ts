import { fail, MatchKind, ok } from "../../match.ts";
import type { Match } from "../../match.ts";
import type { Scope } from "../scope.ts";
import { compile } from "../match.ts";
import { eachInOrder } from "../awaitable.ts";
import type { CompiledPattern } from "../compiled_pattern.ts";
import type { ThenPattern } from "./pattern.ts";

/** Compiles a `Then` pattern into a flattened, reusable closure. */
export function then(pattern: ThenPattern, scope: Scope): CompiledPattern {
  const { patterns } = pattern;
  const children = patterns.map((p) => compile(p, scope));
  return (invocationScope: Scope) => {
    let end = invocationScope;
    const matches: Match[] = [];
    const values: unknown[] = [];
    return eachInOrder<Match, Match>(
      children.length,
      (i) => children[i](end),
      (i, m) => {
        matches.push(m);
        switch (m.kind) {
          case MatchKind.LR:
          case MatchKind.Error:
            return m;
          case MatchKind.Fail:
            return fail(invocationScope, patterns[i], matches);
          case MatchKind.Ok:
            values.push(m.value);
            end = m.scope;
            return undefined;
          case MatchKind.Skip:
            end = m.scope;
            return undefined;
        }
      },
      () => ok(invocationScope, end, pattern, values, matches),
    );
  };
}
