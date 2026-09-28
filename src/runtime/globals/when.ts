import { defineMetadata } from "../value_metadata.ts";
import { rawOf } from "../../wrapped.ts";

/**
 * Conditional value selection. Authors write `(when cond then else)`.
 * Arguments are evaluated eagerly (expression invocation semantics).
 */
export function when(
  condition: unknown,
  thenValue: unknown,
  elseValue: unknown,
): unknown {
  return rawOf(condition) ? thenValue : elseValue;
}

defineMetadata(when, {
  description: "thenValue when condition is truthy, otherwise elseValue.",
  parameters: [{ name: "condition" }, { name: "thenValue" }, {
    name: "elseValue",
  }],
});
