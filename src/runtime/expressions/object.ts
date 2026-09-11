import type { MatchOk } from "../../match.ts";
import { Type, type } from "@justinmchase/type";
import { exec } from "../exec.ts";
import { ExpressionKind } from "./expression.kind.ts";
import type { ObjectExpression } from "./expression.ts";

function assertPropertyKey(
  value: unknown,
): asserts value is PropertyKey {
  const [t] = type(value);
  if (t !== Type.String && t !== Type.Number && t !== Type.Symbol) {
    throw new Error(
      `Object computed key must resolve to a string, number or symbol, got ${t}`,
    );
  }
}

export async function object(
  expression: ObjectExpression,
  match: MatchOk,
): Promise<unknown> {
  const { keys } = expression;
  // Evaluated sequentially (not `Promise.all`) — see invocation.ts for why
  // concurrent sibling-expression evaluation against a shared `match` is
  // unsafe (races the packrat left-recursion memo and `Input.next()`).
  const values: unknown[] = [];
  for (const key of keys) {
    values.push(
      key.kind === ExpressionKind.ObjectComputedKey
        ? [
          await exec(key.keyExpression, match),
          await exec(key.expression, match),
        ]
        : await exec(key.expression, match),
    );
  }
  const buildObject = (resolvedValues: unknown[]) =>
    keys.reduce<Record<PropertyKey, unknown>>(
      (obj, key, i) => {
        const value = resolvedValues[i];
        const { kind } = key;
        switch (kind) {
          case ExpressionKind.ObjectKey:
            return Object.assign(obj, { [key.name]: value });
          case ExpressionKind.ObjectComputedKey: {
            const [keyValue, propertyValue] = value as [unknown, unknown];
            assertPropertyKey(keyValue);
            return Object.assign(obj, { [keyValue]: propertyValue });
          }
          case ExpressionKind.ObjectSpread:
            return { ...obj, ...(value as Record<string, unknown>) };
          default:
            throw new Error(`Unexpected object initializer expression ${kind}`);
        }
      },
      {},
    );

  return buildObject(values);
}
