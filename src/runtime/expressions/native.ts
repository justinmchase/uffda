import type { MatchOk } from "../../match.ts";
import type { NativeExpression } from "./expression.ts";

export async function native(
  expression: NativeExpression,
  match: MatchOk,
): Promise<unknown> {
  const variables = {
    _: match.value,
    ...Object.fromEntries(match.scope.variables),
  };
  const capabilities = new Map<string, unknown>([
    ...match.scope.options.globals.entries(),
    ...match.scope.options.specials.entries(),
  ]);
  return await expression.fn(variables, capabilities, match);
}
