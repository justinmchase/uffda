import { Serializable } from "serializable/mod.ts";
import { fail, Match, ok } from "../../match.ts";
import { Scope } from "../scope.ts";
import { IIncludesPattern } from "./pattern.ts";

export function includes(pattern: IIncludesPattern, scope: Scope): Match {
  const { values } = pattern;
  if (scope.stream.done) {
    return fail(scope, pattern);
  }

  const next = scope.stream.next();
  const end = scope.withInput(next);
  if (values.includes(next.value as Serializable)) {
    return ok(scope, end, pattern, next.value);
  } else {
    return fail(scope, pattern);
  }
}
