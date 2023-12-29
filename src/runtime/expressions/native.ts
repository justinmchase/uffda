import { Match } from "../../match.ts";
import { INativeExpression } from "./expression.ts";

export function native(expression: INativeExpression, match: Match): unknown {
  const variables = {
    _: match.value,
    ...Object.fromEntries(match.end.variables),
  };
  return expression.fn(variables, match.start.options.specials);
}
