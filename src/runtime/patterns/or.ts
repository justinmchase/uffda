import { fail, MatchKind, ok } from "../../match.ts";
import type { Match } from "../../match.ts";
import type { Scope } from "../scope.ts";
import { compile } from "../match.ts";
import type { AwaitableMatch } from "../awaitable.ts";
import type { CompiledPattern } from "../compiled_pattern.ts";
import type { OrPattern } from "./pattern.ts";

/** Matches an `Or` pattern: the interpreted entry point delegates to the
 * same logic as {@link buildOr}, so there is a single implementation. */
export function or(pattern: OrPattern, scope: Scope): AwaitableMatch {
  return buildOr(pattern)(scope);
}

/** Compiles an `Or` pattern into a flattened, reusable closure. */
export function buildOr(pattern: OrPattern): CompiledPattern {
  const { patterns } = pattern;
  const children = patterns.map(compile);
  return async (scope: Scope) => {
    const matches: Match[] = [];
    for (let i = 0; i < children.length; i++) {
      const m = await children[i](scope);
      matches.push(m);
      switch (m.kind) {
        case MatchKind.LR:
        case MatchKind.Error:
          return m;
        case MatchKind.Fail:
          break;
        case MatchKind.Ok:
          return ok(scope, m.scope, pattern, m.value, matches);
      }
    }
    return fail(scope, pattern, matches);
  };
}
