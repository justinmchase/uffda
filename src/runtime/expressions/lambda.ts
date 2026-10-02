import { MatchKind, type MatchSuccess } from "../../match.ts";
import { Input, InputNormalizationMode } from "../../input.ts";
import { exec } from "../exec.ts";
import { match } from "../match.ts";
import type { LambdaExpression } from "./expression.ts";
import { originOf, Wrapped } from "../../wrapped.ts";

export type LambdaCallable = (...args: unknown[]) => Promise<unknown>;

/**
 * Evaluating a lambda produces a callable. Invocation calls that callable with
 * arguments; the callable matches them against the lambda pattern and then
 * evaluates the body expression.
 */
export function lambda(
  e: LambdaExpression,
  m: MatchSuccess,
): Promise<Wrapped<LambdaCallable>> {
  const { pattern, expression } = e;
  const callable = async (...args: unknown[]) => {
    // Raw arguments (for example from a host global) take `m` as origin.
    const stream = new Input(
      args,
      m.scope.stream.path.push(0),
      0,
      undefined,
      InputNormalizationMode.Iterable,
      false,
      false,
      false,
      originOf(m),
    );
    const scope = m.scope.withLayer(stream);
    const result = await match(pattern, scope);
    switch (result.kind) {
      case MatchKind.LR:
        throw new Error("lambda: parameter pattern is left recursive");
      case MatchKind.Error:
        throw new Error(`lambda: ${result.message}`, { cause: result });
      case MatchKind.Fail:
        throw new Error("lambda: arguments did not match parameter pattern");
      case MatchKind.Ok:
      case MatchKind.Skip:
        return await exec(expression, result);
    }
  };
  return Promise.resolve(new Wrapped(callable, originOf(m)));
}
