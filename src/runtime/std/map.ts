export function map(self: unknown[], callback: (value: unknown, index: number, array: unknown[]) => unknown) {
  return Array.prototype.map.bind(self)(callback);
}
