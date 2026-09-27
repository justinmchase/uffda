import type { Scope } from "../scope.ts";
import { fail, type Match, MatchKind, type MatchOk, ok } from "../../match.ts";
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
    const matches: MatchOk[] = [];
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
            matches.push(m);
            s = s.addVariables(m.scope.variables);
            return undefined;
        }
      },
      () => {
        const last = matches.slice(-1)?.[0];
        return ok(s, last?.scope ?? s, pattern, last?.value, matches);
      },
    );
  };
}
