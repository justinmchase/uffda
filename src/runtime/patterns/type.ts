import { fail, Match, ok } from "../../match.ts";
import { Scope } from "../scope.ts";
import { TypePattern } from "./pattern.ts";

export function type(pattern: TypePattern, scope: Scope): Match {
  const { type: expectedType } = pattern;
  if (scope.stream.done) {
    return fail(scope, pattern);
  }

  const end = scope.stream.next();
  const actualType = typeof end.value;
  if (actualType === expectedType) {
    return ok(scope, scope.withInput(end), pattern, end.value);
  } else {
    return fail(scope, pattern);
  }
}
