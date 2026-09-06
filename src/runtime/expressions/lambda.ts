import { fail, MatchKind, type MatchOk } from "../../match.ts";
import { Input, InputNormalizationMode } from "../../input.ts";
import { exec } from "../exec.ts";
import { match } from "../match.ts";
import type { LambdaExpression } from "./expression.ts";

export type LambdaCallable = (...args: unknown[]) => Promise<unknown>;

/**
 * Evaluating a lambda produces a callable. Invocation calls that callable with
 * arguments; the callable matches them against the lambda pattern and then
 * evaluates the body expression.
 */
export function lambda(
  e: LambdaExpression,
  m: MatchOk,
): Promise<LambdaCallable> {
  const { pattern, expression } = e;
  return Promise.resolve(async (...args: unknown[]) => {
    const stream = new Input(
      args,
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
  });
}
