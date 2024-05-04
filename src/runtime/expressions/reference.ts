import { MatchOk } from "../../match.ts";
import { IReferenceExpression } from "./expression.ts";

export function reference(
  expression: IReferenceExpression,
  match: MatchOk,
): unknown {
  const { name } = expression;
  switch (name) {
    case "_":
      return match.value;
    default:
      return match.scope.variables.has(name)
        ? match.scope.variables.get(name)
        : match.scope.options.globals.has(name)
        ? match.scope.options.globals.get(name)
        : undefined;
  }
}
