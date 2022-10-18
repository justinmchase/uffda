import { Match } from "../../match.ts";
import { IReferenceExpression } from "./expression.ts";

export function reference(
  expression: IReferenceExpression,
  match: Match,
): unknown {
  const { name } = expression;
  switch (name) {
    case "_":
      return match.value;
    default:
      return match.end.variables[name];
  }
}
