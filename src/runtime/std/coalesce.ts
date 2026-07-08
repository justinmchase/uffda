export function coalesce(...values: unknown[]) {
  for (const value of values) {
    if (value != null) {
      return value;
    }
  }
  return undefined;
}
