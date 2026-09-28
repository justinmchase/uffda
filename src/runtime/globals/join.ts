import { defineMetadata } from "../value_metadata.ts";
import {
  concat,
  isWrapped,
  rawOf,
  unwrap,
  type Wrapped,
} from "../../wrapped.ts";

/**
 * `Array.prototype.join` that keeps each character's provenance: a string
 * element keeps its own, and a converted element or the default separator
 * takes the joined array's origin.
 */
export function join(self: unknown, separator?: unknown) {
  if (!isWrapped(self)) {
    return (self as unknown[]).join(rawOf(separator) as string | undefined);
  }
  const sep = rawOf(separator) === undefined ? "," : separator;
  const parts: unknown[] = [];
  (self as Wrapped<unknown[]>).raw.forEach((item, i) => {
    if (i > 0) parts.push(sep);
    const raw = rawOf(item);
    if (typeof raw === "string") parts.push(item);
    else if (raw != null) parts.push(String(unwrap(item)));
  });
  return concat(parts, self.origin);
}

defineMetadata(join, {
  description: "Joins an array's elements into a string with a separator.",
  parameters: [{ name: "self" }, { name: "separator", optional: true }],
});
