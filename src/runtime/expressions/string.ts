import { Type, type } from "@justinmchase/type";
import { exec } from "../exec.ts";
import type { MatchOk } from "../../match.ts";
import type { Expression, StringExpression } from "./mod.ts";
import { allOrSync, type Awaitable, isThenable } from "./awaitable.ts";
import { isExpression } from "./expression.ts";

export function string(
  expression: StringExpression,
  match: MatchOk,
): Awaitable<string> {
  const { values } = expression;
  const segments = values.map((value) => {
    const [t, v] = type(value);
    switch (t) {
      case Type.String:
        return v;
      case Type.Object:
        if (isExpression(v)) {
          return exec(v as Expression, match);
        } else {
          return v;
        }
      case Type.Null:
      case Type.Undefined:
      case Type.BigInt:
      case Type.Boolean:
      case Type.Function:
      case Type.Number:
      case Type.Symbol:
      case Type.Array:
      case Type.Error:
      case Type.Map:
      case Type.Set:
      case Type.Date:
      default:
        return value;
    }
  });

  const toStringValue = (segment: unknown): string => `${segment}`;
  const resolved = allOrSync(segments);
  if (isThenable(resolved)) {
    return resolved.then((items) => items.map(toStringValue).join(""));
  }
  return resolved.map(toStringValue).join("");
}
