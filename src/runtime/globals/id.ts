import { defineMetadata } from "../value_metadata.ts";

export function id<T>(value: T): T {
  return value;
}

defineMetadata(id, {
  description: "Returns its argument unchanged.",
  parameters: [{ name: "value" }],
});
