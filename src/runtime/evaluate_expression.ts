import type { Awaitable } from "./awaitable.ts";
import { andThen } from "./awaitable.ts";
import type { Expression } from "./expressions/expression.ts";
import { exec } from "./exec.ts";
import { InputNormalizationMode } from "../input.ts";
import { ok } from "../match.ts";
import { PatternKind } from "./patterns/pattern.kind.ts";
import { Scope } from "./scope.ts";
import { unwrap } from "../wrapped.ts";

export type ExpressionEvaluationOptions = {
  /** Values available to references in the expression, such as `input`/`state`. */
  variables?: Record<string, unknown> | Map<string, unknown>;
  /** Value referenced by `_`; defaults to `undefined`. */
  input?: unknown;
  /** How `input` is normalized into the scope's matching stream. */
  inputKind?: InputNormalizationMode;
  /** Base runtime scope, for custom globals, modules, and resolver settings. */
  scope?: Scope;
};

/**
 * Evaluates a runtime expression with caller-supplied variables and input.
 * The `_` reference resolves to `input`; names such as `state` resolve through
 * `variables`. The returned value is recursively unwrapped like other values
 * returned from Uffda's public host APIs.
 */
export function evaluateExpression(
  expression: Expression,
  options: ExpressionEvaluationOptions = {},
): Awaitable<unknown> {
  const {
    variables,
    input,
    inputKind = InputNormalizationMode.Scalar,
    scope: baseScope = Scope.Default(),
  } = options;
  let scope = baseScope;
  if (Object.hasOwn(options, "input")) {
    scope = scope.withInputValue(input, { kind: inputKind });
  }
  if (variables !== undefined) {
    scope = scope.addVariables(variables);
  }
  const context = ok(
    scope,
    scope,
    { kind: PatternKind.Ok },
    input,
  );
  return andThen(exec(expression, context), unwrap);
}
