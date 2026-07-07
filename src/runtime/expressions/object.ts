import type { MatchOk } from "../../match.ts";
import { exec } from "../exec.ts";
import { ExpressionKind } from "./expression.kind.ts";
import type { ObjectExpression } from "./expression.ts";

export async function object(
  expression: ObjectExpression,
  match: MatchOk,
): Promise<unknown> {
  const { keys } = expression;
  const values = await Promise.all(
    keys.map((key) => exec(key.expression, match)),
  );
  const buildObject = (resolvedValues: unknown[]) =>
    keys.reduce<Record<string, unknown>>(
      (obj, key, i) => {
        const value = resolvedValues[i];
        const { kind } = key;
        switch (kind) {
          case ExpressionKind.ObjectKey:
            return Object.assign(obj, { [key.name]: value });
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
