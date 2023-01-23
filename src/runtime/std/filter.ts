export function filter(
  self: unknown[],
  predicate: (value: unknown, index: number, array: unknown[]) => unknown,
) {
  return Array.prototype.filter.bind(self)(predicate);
}
