import { defineMetadata } from "../value_metadata.ts";
import { carryItem, rawOf } from "../../wrapped.ts";

/**
 * Last element of a string or array, or `fallback` when empty.
 * Authors write `(last items fallback)`. Eager expression-invocation
 * arguments mean `fallback` is not evaluated lazily, so keep it cheap (a
 * literal or already-computed value).
 */
export function last(self: unknown, fallback: unknown): unknown {
  const items = rawOf(self) as ArrayLike<unknown>;
  const i = items.length - 1;
  return i >= 0 ? carryItem(self, items[i], i) : fallback;
}

defineMetadata(last, {
  description: "The last element of a string or array, or fallback when empty.",
  parameters: [{ name: "self" }, { name: "fallback" }],
});
