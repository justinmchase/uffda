import { Type, type } from "@justinmchase/type";
import { exec } from "../exec.ts";
import type { MatchOk } from "../../match.ts";
import type { Expression, StringExpression } from "./mod.ts";
import { isExpression } from "./expression.ts";

export async function string(
  expression: StringExpression,
  match: MatchOk,
): Promise<string> {
  const { values } = expression;
  const segments = await Promise.all(values.map(async (value) => {
    const [t, v] = type(value);
    switch (t) {
      case Type.String:
        return v;
      case Type.Object:
        if (isExpression(v)) {
          return await exec(v as Expression, match);
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
  }));

  const toStringValue = (segment: unknown): string => `${segment}`;
  return segments.map(toStringValue).join("");
}
