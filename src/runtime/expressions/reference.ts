import type { MatchOk } from "../../match.ts";
import type { ReferenceExpression } from "./expression.ts";
import { funcCallable } from "./func_callable.ts";
import { wrapFrom, type Wrapped } from "../../wrapped.ts";

export function reference(
  expression: ReferenceExpression,
  match: MatchOk,
): Wrapped {
  return wrapFrom(resolveReference(expression, match), match);
}

/**
 * The value `expression` names, as stored: wrapped when it was carried there,
 * raw for funcs, globals, specials, and `this`. For callers that observe the
 * value immediately (an invocation target), so it is never wrapped.
 */
export function resolveReference(
  expression: ReferenceExpression,
  match: MatchOk,
): unknown {
  const { name } = expression;
  switch (name) {
    case "_":
      return match.value;
    case "this":
      return match.subject ?? match;
    default:
      if (match.scope.variables.has(name)) {
        return match.scope.variables.get(name);
      }
      {
        const fn = match.scope.getFunc(name);
        if (fn) {
          return funcCallable(fn, match);
        }
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
