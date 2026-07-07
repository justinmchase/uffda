import type { MatchOk } from "../../match.ts";
import { exec } from "../exec.ts";
import { ExpressionKind } from "./expression.kind.ts";
import { allOrSync, type Awaitable, isThenable } from "./awaitable.ts";
import type { ObjectExpression } from "./expression.ts";

export function object(
  expression: ObjectExpression,
  match: MatchOk,
): Awaitable<unknown> {
  const { keys } = expression;
  const values = keys.map((key) => exec(key.expression, match));
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

  const resolved = allOrSync(values);
  return isThenable(resolved)
    ? resolved.then(buildObject)
    : buildObject(resolved);
}
