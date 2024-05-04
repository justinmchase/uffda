import { MatchOk } from "../../match.ts";
import { INativeExpression } from "./expression.ts";

export function native(expression: INativeExpression, match: MatchOk): unknown {
  const variables = {
    _: match.value,
    ...Object.fromEntries(match.scope.variables),
  };
  return expression.fn(variables, match.scope.options.specials);
}
