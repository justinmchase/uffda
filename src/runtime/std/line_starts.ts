/**
 * Ordered line-start offsets for normalized text (always includes 0).
 * Authors write `(line_starts text)`.
 */
export function line_starts(text: string): number[] {
  if (typeof text !== "string") {
    throw new TypeError("line_starts expects a string");
  }
  const starts = [0];
  for (let i = 0; i < text.length; i++) {
    if (text[i] === "\n" && i + 1 <= text.length) {
      starts.push(i + 1);
    }
  }
  return starts;
}
