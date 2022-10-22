import { Match } from "../../match.ts";
import { exec } from "../exec.ts";
import { ExpressionKind } from "./expression.kind.ts";
import {
  IObjectExpression,
  ObjectInitializer,
} from "./expression.ts";

export function object(
  expression: IObjectExpression,
  match: Match,
): unknown {
  const { keys } = expression;
  return keys
    .map<[ObjectInitializer, unknown]>((key) => {
      const { expression } = key;
      return [key, exec(expression, match)];
    })
    .reduce<Record<string, unknown>>(
      (obj, [key, value]) => {
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
}
