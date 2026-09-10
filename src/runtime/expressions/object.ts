import type { MatchOk } from "../../match.ts";
import { exec } from "../exec.ts";
import { ExpressionKind } from "./expression.kind.ts";
import type { ObjectExpression } from "./expression.ts";

function assertPropertyKey(
  value: unknown,
): asserts value is PropertyKey {
  const t = typeof value;
  if (t !== "string" && t !== "number" && t !== "symbol") {
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
  const values = await Promise.all(
    keys.map((key) =>
      key.kind === ExpressionKind.ObjectComputedKey
        ? Promise.all([
          exec(key.keyExpression, match),
          exec(key.expression, match),
        ])
        : exec(key.expression, match)
    ),
  );
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
