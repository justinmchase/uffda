import type { MatchOk } from "../../match.ts";
import type { ReferenceExpression } from "./expression.ts";
import { funcCallable } from "./func_callable.ts";
import { wrap, type Wrapped } from "../../wrapped.ts";

export function reference(
  expression: ReferenceExpression,
  match: MatchOk,
): Wrapped {
  const { name } = expression;
  switch (name) {
    case "_":
      return match.value;
    case "this":
      return wrap(match.subject ?? match, match);
    default:
      if (match.scope.variables.has(name)) {
        return wrap(match.scope.variables.get(name), match);
      }
      {
        const fn = match.scope.getFunc(name);
        if (fn) {
          return wrap(funcCallable(fn, match), match);
        }
      }
      if (match.scope.options.globals.has(name)) {
        return wrap(match.scope.options.globals.get(name), match);
      }
      if (match.scope.options.specials.has(name)) {
        return wrap(match.scope.options.specials.get(name), match);
      }
      throw new ReferenceError(`unknown reference: ${name}`);
  }
}
