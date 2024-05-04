import { fail, Match, ok } from "../../match.ts";
import { Scope } from "../scope.ts";
import { IAnyPattern } from "./pattern.ts";

export function any(pattern: IAnyPattern, scope: Scope): Match {
  if (scope.stream.done) {
    return fail(scope, pattern);
  }
  const next = scope.stream.next();
  const end = scope.withInput(next);
  return ok(scope, end, pattern, next.value);
}
