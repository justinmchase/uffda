import { fail, Match, ok } from "../../match.ts";
import { Scope } from "../scope.ts";
import { IEqualPattern } from "./pattern.ts";

export function equal(pattern: IEqualPattern, scope: Scope): Match {
  const { value } = pattern;
  if (scope.stream.done) {
    return fail(scope, pattern);
  }

  const next = scope.stream.next();
  const end = scope.withInput(next);
  if (next.value === value) {
    return ok(scope, end, pattern, next.value);
  } else {
    return fail(scope, pattern);
  }
}
