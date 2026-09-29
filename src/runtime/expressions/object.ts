import type { MatchOk } from "../../match.ts";
import { Type, type } from "@justinmchase/type";
import { andThen, type Awaitable, mapInOrder } from "../awaitable.ts";
import { exec } from "../exec.ts";
import { ExpressionKind } from "./expression.kind.ts";
import type { ObjectExpression } from "./expression.ts";
import { originOf, rawOf, unwrap, wrap, Wrapped } from "../../wrapped.ts";

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

/**
 * Symbol-keyed properties are host protocol hooks (for example
 * `Symbol.asyncIterator`) that host code reads and calls directly, so they
 * hold raw values; every other property holds a wrapped value.
 */
function propertyValue(key: PropertyKey, value: Wrapped): unknown {
  return typeof key === "symbol" ? unwrap(value) : value;
}

/**
 * The own enumerable properties of a spread value. A raw property of a
 * host-supplied object takes the object's origin.
 */
function spreadProperties(value: Wrapped): Record<PropertyKey, unknown> {
  const raw = rawOf(value);
  if (raw == null || typeof raw !== "object") return {};
  const source = raw as Record<PropertyKey, unknown>;
  const out: Record<PropertyKey, unknown> = {};
  for (const key of Reflect.ownKeys(source)) {
    if (!Object.prototype.propertyIsEnumerable.call(source, key)) continue;
    out[key] = propertyValue(key, wrap(source[key], value.origin));
  }
  return out;
}

export function object(
  expression: ObjectExpression,
  match: MatchOk,
): Awaitable<Wrapped> {
  const { keys } = expression;
  // Evaluated sequentially (not `Promise.all`) — see invocation.ts for why
  // concurrent sibling-expression evaluation against a shared `match` is
  // unsafe (races the packrat left-recursion memo and `Input.next()`).
  const values = mapInOrder(
    keys,
    (key) =>
      key.kind === ExpressionKind.ObjectComputedKey
        ? mapInOrder([key.keyExpression, key.expression], (e) => exec(e, match))
        : exec(key.expression, match),
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
            const [keyWrapped, property] = value as [Wrapped, Wrapped];
            const keyValue = keyWrapped.raw;
            assertPropertyKey(keyValue);
            return Object.assign(obj, {
              [keyValue]: propertyValue(keyValue, property),
            });
          }
          case ExpressionKind.ObjectSpread:
            return { ...obj, ...spreadProperties(value as Wrapped) };
          default:
            throw new Error(`Unexpected object initializer expression ${kind}`);
        }
      },
      {},
    );

  return andThen(
    values,
    (resolved) => new Wrapped(buildObject(resolved), originOf(match)),
  );
}
