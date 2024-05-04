import { fail, Match, MatchKind, ok } from "../../match.ts";
import { Scope } from "../scope.ts";
import { match } from "../match.ts";
import { INotPattern } from "./pattern.ts";

export function not(pattern: INotPattern, scope: Scope): Match {
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
