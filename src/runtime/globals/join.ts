import { defineMetadata } from "../value_metadata.ts";

export function join(self: unknown[], seperator: string | undefined) {
  return Array.prototype.join.bind(self)(seperator);
}

defineMetadata(join, {
  description: "Joins an array's elements into a string with a separator.",
  parameters: [{ name: "self" }, { name: "separator", optional: true }],
});
