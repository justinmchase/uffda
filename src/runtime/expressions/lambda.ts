import { Match } from "../../match.ts";
import { MetaStream } from "../../stream.ts";
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
    const stream = new MetaStream(
      m.end.stream.path.add(0),
      arguments[Symbol.iterator](),
    );
    const scope = m.end.withStream(stream);
    const result = match(pattern, scope);
    if (!result.matched) {
      throw new RuntimeError(
        RuntimeErrorCode.PatternUnmatched,
        pattern,
        result,
      );
    }

    if (!result.end.stream.next().done) {
      throw new RuntimeError(
        RuntimeErrorCode.StreamIncomplete,
        pattern,
        result,
      );
    }

    if (result.errors.length) {
      throw new RuntimeError(
        RuntimeErrorCode.MatchError,
        pattern,
        result,
      );
    }

    return exec(expression, result);
  };
}
