import { defineMetadata } from "../value_metadata.ts";

/**
 * Generic slice: works for strings and arrays, matching JS
 * `String.prototype.slice`/`Array.prototype.slice` semantics (exclusive
 * `end`, negative indices count from the end, omitted `end` slices to the
 * end).
 * Authors write `(slice value start end)`.
 */
export function slice<T extends string | unknown[]>(
  value: T,
  start?: number,
  end?: number,
): T {
  if (typeof value === "string" || Array.isArray(value)) {
    return value.slice(start, end) as T;
  }
  throw new TypeError("slice expects a string or array");
}

defineMetadata(slice, {
  description: "Slices a string or array from start up to (not including) end.",
  parameters: [{ name: "value" }, { name: "start", optional: true }, {
    name: "end",
    optional: true,
  }],
});
