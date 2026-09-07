export function flat(self: unknown[], depth?: number) {
  return Array.prototype.flat.call(self, depth ?? 1) as unknown[];
}
