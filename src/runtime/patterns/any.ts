import { fail, Match, ok } from "../../match.ts";
import { Scope } from "../scope.ts";
import { AnyPattern } from "./pattern.ts";

export function any(pattern: AnyPattern, scope: Scope): Match {
  if (scope.stream.done) {
    return fail(scope, pattern);
  }
  const next = scope.stream.next();
  const end = scope.withInput(next);
  return ok(scope, end, pattern, next.value);
}
