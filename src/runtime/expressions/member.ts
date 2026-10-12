import type { MatchSuccess } from "../../match.ts";
import { andThen, type Awaitable } from "../awaitable.ts";
import { exec } from "../exec.ts";
import type { MemberExpression } from "./expression.ts";
import { wrap, type Wrapped } from "../../wrapped.ts";
import { assertTextValue } from "../conversion.ts";

export function member(
  expression: MemberExpression,
  match: MatchSuccess,
): Awaitable<Wrapped> {
  const { name, expression: expr } = expression;
  return andThen(
    exec(expr, match),
    // A raw property of a host-supplied object takes the object's origin.
    (result) => {
      if (name === "toString") assertTextValue(result.raw);
      return wrap(
        (result.raw as { [key: string]: unknown })[name],
        result.origin,
      );
    },
  );
}
