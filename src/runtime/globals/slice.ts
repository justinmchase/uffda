import { defineMetadata } from "../value_metadata.ts";
import { isWrapped, rawOf, sliceString, type Wrapped } from "../../wrapped.ts";

/**
 * Generic slice: works for strings and arrays, matching JS
 * `String.prototype.slice`/`Array.prototype.slice` semantics (exclusive
 * `end`, negative indices count from the end, omitted `end` slices to the
 * end).
 * Authors write `(slice value start end)`.
 */
export function slice(value: unknown, start?: unknown, end?: unknown) {
  const raw = rawOf(value);
  const s = rawOf(start) as number | undefined;
  const e = rawOf(end) as number | undefined;
  if (typeof raw === "string") {
    return isWrapped(value)
      ? sliceString(value as Wrapped<string>, s, e)
      : raw.slice(s, e);
  }
  if (Array.isArray(raw)) return raw.slice(s, e);
  throw new TypeError("slice expects a string or array");
}

defineMetadata(slice, {
  description: "Slices a string or array from start up to (not including) end.",
  parameters: [{ name: "value" }, { name: "start", optional: true }, {
    name: "end",
    optional: true,
  }],
});
