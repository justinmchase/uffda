import { Match } from "../../match.ts";
import { INativeExpression } from "./expression.ts";

export function native(expression: INativeExpression, match: Match): unknown {
  const variables = Object.assign({}, match.end.variables, { _: match.value });
  return expression.fn(variables, match.start.options.specials ?? {});
}
