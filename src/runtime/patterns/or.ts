import { fail, type Match, MatchKind, ok } from "../../match.ts";
import type { Scope } from "../scope.ts";
import { compile, match } from "../match.ts";
import type { CompiledPattern } from "../compiled_pattern.ts";
import type { OrPattern } from "./pattern.ts";

export async function or(pattern: OrPattern, scope: Scope): Promise<Match> {
  const { patterns } = pattern;
  const matches: Match[] = [];
  for (const pattern of patterns) {
    const m = await match(pattern, scope);
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
