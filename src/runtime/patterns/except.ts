import { fail, type Match, MatchKind, ok } from "../../match.ts";
import { match } from "../match.ts";
import type { Scope } from "../scope.ts";
import type { ExceptPattern } from "./pattern.ts";

export function except(pattern: ExceptPattern, scope: Scope): Match {
  if (scope.stream.done) {
    return fail(scope, pattern);
  }

  const assertion = match(pattern.pattern, scope);
  switch (assertion.kind) {
    case MatchKind.LR:
    case MatchKind.Error:
      return assertion;
    case MatchKind.Ok:
      return fail(scope, pattern, [assertion]);
    case MatchKind.Fail: {
      const next = scope.stream.next();
      const end = scope.withInput(next);
      return ok(scope, end, pattern, next.value, [assertion]);
    }
  }
}
