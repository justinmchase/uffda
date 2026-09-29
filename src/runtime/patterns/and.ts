import type { Scope } from "../scope.ts";
import {
  fail,
  forward,
  type Match,
  MatchKind,
  type MatchSuccess,
  ok,
} from "../../match.ts";
import { compile } from "../match.ts";
import { eachInOrder } from "../awaitable.ts";
import type { CompiledPattern } from "../compiled_pattern.ts";
import type { AndPattern } from "./pattern.ts";

/** Compiles an `And` pattern into a flattened, reusable closure. */
export function and(pattern: AndPattern, scope: Scope): CompiledPattern {
  const { patterns } = pattern;
  const children = patterns.map((p) => compile(p, scope));
  return (invocationScope: Scope) => {
    let s = invocationScope;
    const matches: MatchSuccess[] = [];
    return eachInOrder<Match, Match>(
      children.length,
      (i) => children[i](s),
      (i, m) => {
        switch (m.kind) {
          case MatchKind.LR:
          case MatchKind.Error:
            return m;
          case MatchKind.Fail:
            return fail(invocationScope, patterns[i], [...matches, m]);
          case MatchKind.Ok:
          case MatchKind.Skip:
            matches.push(m);
            s = s.addVariables(m.scope.variables);
            return undefined;
        }
      },
      () => {
        const last = matches.at(-1);
        return last
          ? forward(s, last.scope, pattern, last, matches)
          : ok(s, s, pattern, undefined, matches);
      },
    );
  };
}
