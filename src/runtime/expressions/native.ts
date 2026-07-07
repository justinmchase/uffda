import type { MatchOk } from "../../match.ts";
import type { NativeExpression } from "./expression.ts";

export function native(expression: NativeExpression, match: MatchOk): unknown {
  const variables = {
    _: match.value,
    ...Object.fromEntries(match.scope.variables),
  };
  const capabilities = new Map<string, unknown>([
    ...match.scope.options.globals.entries(),
    ...match.scope.options.specials.entries(),
  ]);
  return expression.fn(variables, capabilities, match);
}
