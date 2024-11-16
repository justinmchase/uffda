import { type Match, MatchKind } from "../../match.ts";
import { Input } from "../../input.ts";
import { exec } from "../exec.ts";
import { match } from "../match.ts";
import type { LambdaExpression } from "./expression.ts";
import { fail } from "../../mod.ts";

export function lambda(
  e: LambdaExpression,
  m: Match,
): unknown {
  const { pattern, expression } = e;
  return function () {
    const stream = new Input(
      arguments,
      m.scope.stream.path.push(0), // todo: should this have a lambda segment?
    );
    const scope = m.scope.withInput(stream);
    const result = match(pattern, scope);
    switch (result.kind) {
      case MatchKind.LR:
      case MatchKind.Error:
        return result;
      case MatchKind.Fail:
        return fail(scope, pattern, [result]);
      case MatchKind.Ok:
        return exec(expression, result);
    }
  };
}
