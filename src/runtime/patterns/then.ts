import { fail, MatchKind, ok } from "../../match.ts";
import type { Match } from "../../match.ts";
import type { Scope } from "../scope.ts";
import { compile } from "../match.ts";
import type { AwaitableMatch } from "../awaitable.ts";
import type { CompiledPattern } from "../compiled_pattern.ts";
import type { ThenPattern } from "./pattern.ts";

/** Matches a `Then` pattern: the interpreted entry point delegates to the
 * same logic as {@link buildThen}, so there is a single implementation. */
export function then(pattern: ThenPattern, scope: Scope): AwaitableMatch {
  return buildThen(pattern)(scope);
}

/** Compiles a `Then` pattern into a flattened, reusable closure. */
export function buildThen(pattern: ThenPattern): CompiledPattern {
  const { patterns } = pattern;
  const children = patterns.map(compile);
  return async (scope: Scope) => {
    let end = scope;
    const matches: Match[] = [];
    const values: unknown[] = [];
    for (let i = 0; i < children.length; i++) {
      const m = await children[i](end);
      matches.push(m);
      switch (m.kind) {
        case MatchKind.LR:
        case MatchKind.Error:
          return m;
        case MatchKind.Fail:
          return fail(scope, patterns[i], matches);
        case MatchKind.Ok:
          values.push(m.value);
          end = m.scope;
          break;
      }
    }
    return ok(scope, end, pattern, values, matches);
  };
}
