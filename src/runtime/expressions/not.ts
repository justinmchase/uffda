import type { MatchSuccess } from "../../match.ts";
import { andThen, type Awaitable } from "../awaitable.ts";
import { exec } from "../exec.ts";
import type { NotExpression } from "./expression.ts";
import { originOf, rawOf, Wrapped } from "../../wrapped.ts";

export function not(
  expression: NotExpression,
  match: MatchSuccess,
): Awaitable<Wrapped<boolean>> {
  return andThen(
    exec(expression.expression, match),
    (result) => new Wrapped(!rawOf(result), originOf(match)),
  );
}
