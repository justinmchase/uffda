import { fail, type Match, MatchKind, ok } from "../../match.ts";
import type { Scope } from "../scope.ts";
import { match } from "../match.ts";
import type { NotPattern } from "./pattern.ts";

export function not(pattern: NotPattern, scope: Scope): Match {
  const m = match(pattern.pattern, scope);
  switch (m.kind) {
    case MatchKind.LR:
    case MatchKind.Error:
      return m;
    case MatchKind.Ok:
      return fail(scope, pattern, [m]);
    case MatchKind.Fail:
      return ok(scope, m.scope, pattern, undefined, [m]);
  }
}
