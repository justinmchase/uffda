import type { Scope } from "../scope.ts";
import { fail, type Match, MatchKind, type MatchOk, ok } from "../../match.ts";
import { match } from "../match.ts";
import type { AndPattern } from "./pattern.ts";

export function and(pattern: AndPattern, scope: Scope): Match {
  const { patterns } = pattern;
  const matches: MatchOk[] = [];
  for (const pattern of patterns) {
    const m = match(pattern, scope);
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
