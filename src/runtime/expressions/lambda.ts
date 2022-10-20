import { Match } from "../../match.ts";
import { Scope } from "../../scope.ts";
import { MetaStream } from "../../stream.ts";
import { exec } from "../exec.ts";
import { match } from "../match.ts";
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
    )
    const scope = m.end.withStream(stream)
    const result = match(pattern, scope)
    if (!result.matched) {
      // todo: Create custom errors for each of these states...
      throw new Error("input failed to match pattern");
    }

    if (!result.end.stream.next().done) {
      throw new Error("pattern failed to match entire input");
    }

    if (result.errors.length) {
      throw new Error("pattern matched but with errors", {
        // todo: aggregate error?
        cause: result.errors[0]
      })
    }

    return exec(expression, result);
  }
}
