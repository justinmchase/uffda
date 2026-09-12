import type { MatchOk } from "../../match.ts";
import type { ReferenceExpression } from "./expression.ts";
import { funcCallable } from "./func_callable.ts";

export function reference(
  expression: ReferenceExpression,
  match: MatchOk,
): Promise<unknown> {
  const { name } = expression;
  switch (name) {
    case "_":
      return Promise.resolve(match.value);
    case "this":
      return Promise.resolve(match);
    default:
      if (match.scope.variables.has(name)) {
        return Promise.resolve(match.scope.variables.get(name));
      }
      {
        const fn = match.scope.getFunc(name);
        if (fn) {
          return Promise.resolve(funcCallable(fn, match));
        }
      }
      if (match.scope.options.globals.has(name)) {
        return Promise.resolve(match.scope.options.globals.get(name));
      }
      if (match.scope.options.specials.has(name)) {
        return Promise.resolve(match.scope.options.specials.get(name));
      }
      return Promise.reject(new ReferenceError(`unknown reference: ${name}`));
  }
}
