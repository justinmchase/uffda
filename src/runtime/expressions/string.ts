import { Type, type } from "@justinmchase/type";
import { andThen, type Awaitable, mapInOrder } from "../awaitable.ts";
import { exec } from "../exec.ts";
import type { MatchOk } from "../../match.ts";
import type { Expression, StringExpression } from "./mod.ts";
import { isExpression } from "./expression.ts";

export function string(
  expression: StringExpression,
  match: MatchOk,
): Awaitable<string> {
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

  const toStringValue = (segment: unknown): string => `${segment}`;
  return andThen(segments, (parts) => parts.map(toStringValue).join(""));
}
