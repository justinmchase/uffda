export function memberChain(
  expression: unknown,
  segments: Array<{ name: string }>,
): unknown {
  let current = expression;
  for (const segment of segments) {
    current = {
      kind: "member",
      expression: current,
      name: segment.name,
    };
  }
  return current;
}
