import { Match } from "../../match.ts";
import { Input } from "../../input.ts";
import { exec } from "../exec.ts";
import { match } from "../match.ts";
import { RuntimeError, RuntimeErrorCode } from "../runtime.error.ts";
import { ILambdaExpression } from "./expression.ts";

export function lambda(
  e: ILambdaExpression,
  m: Match,
): unknown {
  const { pattern, expression } = e;
  return function () {
    const stream = new Input(
      m.end.stream.path.push(0),
      arguments[Symbol.iterator](),
    );
    const scope = m.end.withStream(stream);
    const result = match(pattern, scope);
    if (!result.matched) {
      throw new RuntimeError(
        RuntimeErrorCode.PatternUnmatched,
        scope.module,
        scope.ruleStack[-1],
        pattern,
        result,
      );
    }

    if (!result.end.stream.next().done) {
      throw new RuntimeError(
        RuntimeErrorCode.StreamIncomplete,
        scope.module,
        scope.ruleStack[-1],
        pattern,
        result,
      );
    }

    if (result.errors.length) {
      throw new RuntimeError(
        RuntimeErrorCode.MatchError,
        scope.module,
        scope.ruleStack[-1],
        pattern,
        result,
      );
    }

    return exec(expression, result);
  };
}
