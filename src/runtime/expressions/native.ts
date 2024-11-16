import type { MatchOk } from "../../match.ts";
import type { NativeExpression } from "./expression.ts";

export function native(expression: NativeExpression, match: MatchOk): unknown {
  const variables = {
    _: match.value,
    ...Object.fromEntries(match.scope.variables),
  };
  return expression.fn(variables, match.scope.options.specials);
}
