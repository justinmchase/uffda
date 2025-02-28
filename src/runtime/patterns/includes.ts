import type { Serializable } from "@justinmchase/serializable";
import { fail, type Match, ok } from "../../match.ts";
import type { Scope } from "../scope.ts";
import type { IncludesPattern } from "./pattern.ts";

export function includes(pattern: IncludesPattern, scope: Scope): Match {
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
