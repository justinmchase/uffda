export function join(self: unknown[], seperator: string | undefined) {
  return Array.prototype.join.bind(self)(seperator);
}
