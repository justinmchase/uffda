import { defineMetadata } from "../value_metadata.ts";
import { rawOf } from "../../wrapped.ts";

/**
 * Build a plain object from an entry list. Authors write `(from_entries xs)`.
 *
 * Accepts an array of:
 * - `[key, value]` pairs
 * - `{ name, pattern }` or `{ name, value }` objects (OverEntry shape)
 */
export function from_entries(self: unknown): Record<string, unknown> {
  const entries = rawOf(self);
  if (!Array.isArray(entries)) {
    throw new TypeError("from_entries expects an array");
  }
  return Object.fromEntries(
    entries.map((item, index) => {
      const entry = rawOf(item);
      if (Array.isArray(entry) && entry.length >= 2) {
        return [rawOf(entry[0]), entry[1]];
      }
      if (entry != null && typeof entry === "object") {
        const record = entry as Record<string, unknown>;
        if ("name" in record) {
          const value = "pattern" in record ? record.pattern : record.value;
          return [rawOf(record.name), value];
        }
      }
      throw new TypeError(
        `from_entries entry ${index} must be a [key, value] pair or { name, ... }`,
      );
    }),
  );
}

defineMetadata(from_entries, {
  description:
    "Builds an object from [key, value] pairs or { name, value } entries.",
  parameters: [{ name: "entries" }],
});
