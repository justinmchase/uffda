import { fail, Match, MatchKind, ok } from "../../match.ts";
import { Scope } from "../scope.ts";
import { match } from "../match.ts";
import { exec } from "../exec.ts";
import { ProjectionPattern } from "./pattern.ts";

export function projection(pattern: ProjectionPattern, scope: Scope): Match {
  const m = match(pattern.pattern, scope);
  switch (m.kind) {
    case MatchKind.LR:
    case MatchKind.Error:
      return m;
    case MatchKind.Fail:
      return fail(scope, pattern, [m]);
    case MatchKind.Ok:
      break;
  }

  const value = exec(pattern.expression, m);
  return ok(scope, m.scope, pattern, value, [m]);
}
