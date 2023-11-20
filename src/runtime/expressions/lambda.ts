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
      arguments,
      m.end.stream.path.push(0),
    );
    const scope = m.end.withInput(stream);
    const result = match(pattern, scope);
    if (!result.matched) {
      throw new RuntimeError(
        RuntimeErrorCode.PatternUnmatched,
        scope,
        result,
      );
    }

    if (!result.end.stream.next().done) {
      throw new RuntimeError(
        RuntimeErrorCode.StreamIncomplete,
        scope,
        result,
      );
    }

    if (result.errors.length) {
      throw new RuntimeError(
        RuntimeErrorCode.MatchError,
        scope,
        result,
      );
    }

    return exec(expression, result);
  };
}
