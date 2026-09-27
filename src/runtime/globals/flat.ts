import { defineMetadata } from "../value_metadata.ts";

export function flat(self: unknown[], depth?: number) {
  return Array.prototype.flat.call(self, depth ?? 1) as unknown[];
}

defineMetadata(flat, {
  description: "Flattens an array by depth levels (default 1).",
  parameters: [{ name: "self" }, { name: "depth", optional: true }],
});
