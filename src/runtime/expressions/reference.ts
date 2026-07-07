import type { MatchOk } from "../../match.ts";
import type { ReferenceExpression } from "./expression.ts";

export async function reference(
  expression: ReferenceExpression,
  match: MatchOk,
): Promise<unknown> {
  const { name } = expression;
  switch (name) {
    case "_":
      return match.value;
    default:
      if (match.scope.variables.has(name)) {
        return match.scope.variables.get(name);
      }
      if (match.scope.options.globals.has(name)) {
        return match.scope.options.globals.get(name);
      }
      if (match.scope.options.specials.has(name)) {
        return match.scope.options.specials.get(name);
      }
      throw new ReferenceError(`unknown reference: ${name}`);
  }
}
