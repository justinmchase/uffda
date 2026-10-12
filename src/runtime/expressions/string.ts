import { Type, type } from "@justinmchase/type";
import { andThen, type Awaitable, mapInOrder } from "../awaitable.ts";
import { exec } from "../exec.ts";
import type { MatchSuccess } from "../../match.ts";
import type { Expression, StringExpression } from "./mod.ts";
import { isExpression } from "./expression.ts";
import { concat, originOf, rawOf, Wrapped } from "../../wrapped.ts";
import { stringText } from "../conversion.ts";

export function string(
  expression: StringExpression,
  match: MatchSuccess,
): Awaitable<Wrapped<string>> {
  const { values } = expression;
  // Evaluated sequentially (not `Promise.all`) — see invocation.ts for why
  // concurrent sibling-expression evaluation against a shared `match` is
  // unsafe (races the packrat left-recursion memo and `Input.next()`).
  const segments = mapInOrder(values, (value) => {
    const [t, v] = type(value);
    switch (t) {
      case Type.String:
        return v;
      case Type.Object:
        return isExpression(v) ? exec(v as Expression, match) : v;
      default:
        return value;
    }
  });

  // Interpolated strings keep their characters' provenance; any other
  // segment is converted to text computed by this match.
  const toText = (segment: unknown): unknown =>
    type(rawOf(segment))[0] === Type.String
      ? segment
      : new Wrapped(stringText(segment), originOf(match));
  return andThen(
    segments,
    (parts) => concat(parts.map(toText), originOf(match)),
  );
}
