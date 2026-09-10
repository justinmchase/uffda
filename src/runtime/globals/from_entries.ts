/**
 * Build a plain object from an entry list. Authors write `(from_entries xs)`.
 *
 * Accepts an array of:
 * - `[key, value]` pairs
 * - `{ name, pattern }` or `{ name, value }` objects (OverEntry shape)
 */
export function from_entries(entries: unknown): Record<string, unknown> {
  if (!Array.isArray(entries)) {
    throw new TypeError("from_entries expects an array");
  }
  return Object.fromEntries(
    entries.map((entry, index) => {
      if (Array.isArray(entry) && entry.length >= 2) {
        return [entry[0], entry[1]];
      }
      if (entry != null && typeof entry === "object") {
        const record = entry as Record<string, unknown>;
        if ("name" in record) {
          const value = "pattern" in record ? record.pattern : record.value;
          return [record.name, value];
        }
      }
      throw new TypeError(
        `from_entries entry ${index} must be a [key, value] pair or { name, ... }`,
      );
    }),
  );
}
