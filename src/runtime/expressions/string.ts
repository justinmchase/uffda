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
  // Evaluated sequentially (not `Promise.all`) — see invocation.ts for why
  // concurrent sibling-expression evaluation against a shared `match` is
  // unsafe (races the packrat left-recursion memo and `Input.next()`).
  const segments: unknown[] = [];
  for (const value of values) {
    const [t, v] = type(value);
    switch (t) {
      case Type.String:
        segments.push(v);
        break;
      case Type.Object:
        if (isExpression(v)) {
          segments.push(await exec(v as Expression, match));
        } else {
          segments.push(v);
        }
        break;
      default:
        segments.push(value);
        break;
    }
  }

  const toStringValue = (segment: unknown): string => `${segment}`;
  return segments.map(toStringValue).join("");
}
