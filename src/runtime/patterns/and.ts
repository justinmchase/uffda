import type { Scope } from "../scope.ts";
import { fail, type Match, MatchKind, type MatchOk, ok } from "../../match.ts";
import { compile, match } from "../match.ts";
import type { CompiledPattern } from "../compiled_pattern.ts";
import type { AndPattern } from "./pattern.ts";

export async function and(pattern: AndPattern, scope: Scope): Promise<Match> {
  const { patterns } = pattern;
  const matches: MatchOk[] = [];
  for (const pattern of patterns) {
    const m = await match(pattern, scope);
    switch (m.kind) {
      case MatchKind.LR:
      case MatchKind.Error:
        return m;
      case MatchKind.Fail:
        return fail(scope, pattern, [...matches, m]);
      case MatchKind.Ok:
        matches.push(m);
        scope = scope.addVariables(m.scope.variables);
        break;
    }
  }

  // The last match is the one that dictates the value and what is consumed
  const last = matches.slice(-1)?.[0];
  return ok(scope, last?.scope ?? scope, pattern, last?.value, matches);
}

/** Compiles an `And` pattern into a flattened, reusable closure. */
export function buildAnd(pattern: AndPattern): CompiledPattern {
  const { patterns } = pattern;
  const children = patterns.map(compile);
  return async (scope: Scope) => {
    let s = scope;
    const matches: MatchOk[] = [];
    for (let i = 0; i < children.length; i++) {
      const m = await children[i](s);
      switch (m.kind) {
        case MatchKind.LR:
        case MatchKind.Error:
          return m;
        case MatchKind.Fail:
          return fail(scope, patterns[i], [...matches, m]);
        case MatchKind.Ok:
          matches.push(m);
          s = s.addVariables(m.scope.variables);
          break;
      }
    }
    const last = matches.slice(-1)?.[0];
    return ok(s, last?.scope ?? s, pattern, last?.value, matches);
  };
}
