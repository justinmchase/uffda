import { error, MatchErrorCode } from "../match.ts";
import type { Match } from "../match.ts";
import type { Pattern } from "./patterns/pattern.ts";
import type { Scope } from "./scope.ts";

/**
 * Normalizes an expression exception (a synchronous throw or an async
 * rejection) into an `ExpressionException` error match.
 */
export function expressionError(
  scope: Scope,
  pattern: Pattern,
  err: unknown,
): Match {
  const message = err instanceof Error ? err.message : `${err}`;
  return error(
    scope,
    pattern,
    MatchErrorCode.ExpressionException,
    `expression exception: ${message}`,
    err,
  );
}
