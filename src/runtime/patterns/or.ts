import { fail, type Match, MatchKind, ok } from "../../match.ts";
import type { Scope } from "../scope.ts";
import { match } from "../match.ts";
import type { OrPattern } from "./pattern.ts";

export function or(pattern: OrPattern, scope: Scope) {
  const { patterns } = pattern;
  const matches: Match[] = [];
  for (const pattern of patterns) {
    const m = match(pattern, scope);
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
