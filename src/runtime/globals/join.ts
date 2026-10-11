import { defineMetadata } from "../value_metadata.ts";
import { concat, isWrapped, rawOf, type Wrapped } from "../../wrapped.ts";
import { stringText } from "../conversion.ts";

/**
 * `Array.prototype.join` that keeps each character's provenance: a string
 * element keeps its own, and a converted element or the default separator
 * takes the joined array's origin.
 */
export function join(self: unknown, separator?: unknown) {
  if (!isWrapped(self)) {
    const sep = rawOf(separator) === undefined ? "," : stringText(separator);
    return (self as unknown[]).map((item) =>
      rawOf(item) == null ? "" : stringText(item)
    ).join(sep);
  }
  if (rawOf(separator) !== undefined) stringText(separator);
  const sep = rawOf(separator) === undefined ? "," : separator;
  const parts: unknown[] = [];
  (self as Wrapped<unknown[]>).raw.forEach((item, i) => {
    if (i > 0) parts.push(sep);
    const raw = rawOf(item);
    if (typeof raw === "string") parts.push(item);
    else if (raw != null) parts.push(stringText(item));
  });
  return concat(parts, self.origin);
}

defineMetadata(join, {
  description: "Joins an array's elements into a string with a separator.",
  parameters: [{ name: "self" }, { name: "separator", optional: true }],
});
