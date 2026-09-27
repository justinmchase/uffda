import { fail, MatchKind, ok } from "../../match.ts";
import type { Match } from "../../match.ts";
import type { Scope } from "../scope.ts";
import { compile } from "../match.ts";
import { eachInOrder } from "../awaitable.ts";
import type { CompiledPattern } from "../compiled_pattern.ts";
import type { OrPattern } from "./pattern.ts";

/** Compiles an `Or` pattern into a flattened, reusable closure. */
export function or(pattern: OrPattern, scope: Scope): CompiledPattern {
  const { patterns } = pattern;
  const children = patterns.map((p) => compile(p, scope));
  return (invocationScope: Scope) => {
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
            return ok(invocationScope, m.scope, pattern, m.value, matches);
        }
      },
      () => fail(invocationScope, pattern, matches),
    );
  };
}
