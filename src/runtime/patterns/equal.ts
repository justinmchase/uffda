import { fail, type Match, ok } from "../../match.ts";
import type { Scope } from "../scope.ts";
import type { EqualPattern } from "./pattern.ts";
import { resolvePatternValueOperand } from "./value_source.ts";

export function equal(pattern: EqualPattern, scope: Scope): Match {
  const resolved = resolvePatternValueOperand(pattern.value, scope, pattern);
  if (resolved.kind === "error") {
    return resolved.match;
  }
  const value = resolved.value;

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
