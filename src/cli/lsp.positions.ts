/**
 * Converts between absolute character offsets and LSP `{line, character}`
 * positions. LSP counts `character` in UTF-16 code units, which matches
 * JavaScript string indexing, so no re-encoding is needed.
 */

export function positionToOffset(
  source: string,
  position: { line: number; character: number },
): number {
  let offset = 0;
  let line = 0;
  while (line < position.line) {
    const next = source.indexOf("\n", offset);
    if (next === -1) {
      // Position refers to a line past the document's end; clamp to EOF.
      return source.length;
    }
    offset = next + 1;
    line++;
  }
  const lineEnd = source.indexOf("\n", offset);
  const lineLength = (lineEnd === -1 ? source.length : lineEnd) - offset;
  return offset + Math.min(position.character, lineLength);
}

/** Inverse of {@link positionToOffset}. */
export function offsetToPosition(
  source: string,
  offset: number,
): { line: number; character: number } {
  const clamped = Math.max(0, Math.min(offset, source.length));
  const before = source.slice(0, clamped);
  const lines = before.split("\n");
  return { line: lines.length - 1, character: lines.at(-1)?.length ?? 0 };
}
