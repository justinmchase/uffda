import type { MatchOk } from "../../match.ts";
import type { SpecialReferenceExpression } from "./expression.ts";

export function special(
  expression: SpecialReferenceExpression,
  match: MatchOk,
): unknown {
  const { name } = expression;
  const special = match.scope.getSpecial(name);
  if (typeof special === "function") {
    const variables = Object.assign({}, match.scope.variables, {
      _: match.value,
    });
    return special(variables);
  } else {
    return special;
  }
}
