import { fail, type Match, MatchKind, ok } from "../../match.ts";
import { match } from "../match.ts";
import type { Scope } from "../scope.ts";
import type { LookaheadPattern } from "./pattern.ts";

export function lookahead(pattern: LookaheadPattern, scope: Scope): Match {
  const m = match(pattern.pattern, scope);
  switch (m.kind) {
    case MatchKind.LR:
    case MatchKind.Error:
      return m;
    case MatchKind.Fail:
      return fail(scope, pattern, [m]);
    case MatchKind.Ok:
      return ok(scope, scope, pattern, m.value, [m]);
  }
}
