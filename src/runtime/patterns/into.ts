import { type } from "@justinmchase/type";
import { error, fail, MatchErrorCode, MatchKind, ok } from "../../match.ts";
import { Input } from "../../input.ts";
import { match } from "../match.ts";
import type { Scope } from "../scope.ts";
import type { IntoPattern } from "./pattern.ts";

export function into(pattern: IntoPattern, scope: Scope) {
  if (scope.stream.done) {
    return fail(scope, pattern);
  }

  const next = scope.stream.next();
  if (!Input.isIterable(next.value)) {
    const [t] = type(next.value);
    return error(
      scope,
      pattern,
      MatchErrorCode.IterableExpected,
      `expected value to be iterable but got type ${t}`,
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
