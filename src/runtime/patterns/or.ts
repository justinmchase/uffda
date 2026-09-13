import { fail, MatchKind, ok } from "../../match.ts";
import type { Match } from "../../match.ts";
import type { Scope } from "../scope.ts";
import { compile } from "../match.ts";
import type { CompiledPattern } from "../compiled_pattern.ts";
import type { OrPattern } from "./pattern.ts";

/** Compiles an `Or` pattern into a flattened, reusable closure. */
export function or(pattern: OrPattern, scope: Scope): CompiledPattern {
  const { patterns } = pattern;
  const children = patterns.map((p) => compile(p, scope));
  return async (invocationScope: Scope) => {
    const matches: Match[] = [];
    for (let i = 0; i < children.length; i++) {
      const m = await children[i](invocationScope);
      matches.push(m);
      switch (m.kind) {
        case MatchKind.LR:
        case MatchKind.Error:
          return m;
        case MatchKind.Fail:
          break;
        case MatchKind.Ok:
          return ok(invocationScope, m.scope, pattern, m.value, matches);
      }
    }
    return fail(invocationScope, pattern, matches);
  };
}
