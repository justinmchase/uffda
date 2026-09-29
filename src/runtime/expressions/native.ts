import type { MatchSuccess } from "../../match.ts";
import type { NativeExpression } from "./expression.ts";
import { wrapFrom, type Wrapped } from "../../wrapped.ts";

export async function native(
  expression: NativeExpression,
  match: MatchSuccess,
): Promise<Wrapped> {
  const variables = {
    _: match.value,
    ...Object.fromEntries(match.scope.variables),
  };
  const capabilities = new Map<string, unknown>([
    ...match.scope.options.globals.entries(),
    ...match.scope.options.specials.entries(),
  ]);
  return wrapFrom(await expression.fn(variables, capabilities, match), match);
}
