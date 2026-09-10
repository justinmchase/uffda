/**
 * Conditional value selection. Authors write `(when cond then else)`.
 * Arguments are evaluated eagerly (expression invocation semantics).
 */
export function when(
  condition: unknown,
  thenValue: unknown,
  elseValue: unknown,
): unknown {
  return condition ? thenValue : elseValue;
}
