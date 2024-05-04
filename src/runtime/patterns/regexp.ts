import { error, fail, Match, MatchErrorCode, ok } from "../../match.ts";
import { Scope } from "../scope.ts";
import { RegExpPattern } from "./pattern.ts";

export function regexp(pattern: RegExpPattern, scope: Scope): Match {
  if (scope.stream.done) {
    return fail(scope, pattern);
  }
  const next = scope.stream.next();
  const end = scope.withInput(next);
  if (typeof next.value !== "string") {
    return error(
      scope,
      pattern,
      MatchErrorCode.Type,
      `expected value to be a string but got ${typeof next.value}`,
    );
  }

  if (pattern.pattern.test(next.value)) {
    return ok(scope, end, pattern, next.value);
  } else {
    return fail(scope, pattern);
  }
}
