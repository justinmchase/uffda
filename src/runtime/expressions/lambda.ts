import { type Match, MatchKind } from "../../match.ts";
import { Input, InputNormalizationMode } from "../../input.ts";
import { exec } from "../exec.ts";
import { match } from "../match.ts";
import type { LambdaExpression } from "./expression.ts";
import { fail } from "../../mod.ts";

export async function lambda(
  e: LambdaExpression,
  m: Match,
): Promise<unknown> {
  const { pattern, expression } = e;
  return async function () {
    const stream = new Input(
      arguments,
      m.scope.stream.path.push(0), // todo: should this have a lambda segment?
      0,
      undefined,
      InputNormalizationMode.Iterable,
    );
    const scope = m.scope.withInput(stream);
    const result = await match(pattern, scope);
    switch (result.kind) {
      case MatchKind.LR:
      case MatchKind.Error:
        return result;
      case MatchKind.Fail:
        return fail(scope, pattern, [result]);
      case MatchKind.Ok:
        return await exec(expression, result);
    }
  };
}
