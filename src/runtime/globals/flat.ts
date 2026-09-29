import { defineMetadata } from "../value_metadata.ts";
import { rawOf } from "../../wrapped.ts";

/** `Array.prototype.flat` over arrays whose elements may be wrapped. */
function flatten(items: unknown[], depth: number, out: unknown[]): unknown[] {
  for (const item of items) {
    const raw = rawOf(item);
    if (depth > 0 && Array.isArray(raw)) flatten(raw, depth - 1, out);
    else out.push(item);
  }
  return out;
}

export function flat(self: unknown, depth?: unknown) {
  return flatten(rawOf(self) as unknown[], (rawOf(depth) as number) ?? 1, []);
}

defineMetadata(flat, {
  description: "Flattens an array by depth levels (default 1).",
  parameters: [{ name: "self" }, { name: "depth", optional: true }],
});
