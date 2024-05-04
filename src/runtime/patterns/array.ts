import { error, fail, MatchErrorCode, MatchKind, ok } from "../../match.ts";
import { Scope } from "../scope.ts";
import { Input } from "../../input.ts";
import { match } from "../match.ts";
import { ArrayPattern } from "./pattern.ts";

// deno-lint-ignore no-explicit-any
function isIterable(value: any): value is Iterable<unknown> {
  if (value == null) {
    return false;
  }
  return typeof value[Symbol.iterator] === "function";
}

export function array(pattern: ArrayPattern, scope: Scope) {
  if (scope.stream.done) {
    return fail(scope, pattern);
  }

  const next = scope.stream.next();
  if (next.value == null) {
    return error(
      scope,
      pattern,
      MatchErrorCode.NullValue,
      "expected value to be non-null",
    );
  }
  if (!isIterable(next.value)) {
    return error(
      scope,
      pattern,
      MatchErrorCode.IterableExpected,
      "expected value to be iterable",
    );
  }

  const innerStream = new Input(
    next.value,
    scope.stream.path.push(0),
  );
  const innerScope = scope
    .withInput(innerStream);

  const m = match(pattern.pattern, innerScope);
  const end = scope
    .withInput(next)
    .addVariables(m.scope.variables);
  switch (m.kind) {
    case MatchKind.LR:
    case MatchKind.Error:
      return m;
    case MatchKind.Fail:
      return fail(scope, pattern, [m]);
    case MatchKind.Ok:
      return ok(scope, end, pattern, m.value, [m]);
  }
}
