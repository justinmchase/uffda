import type { Pattern } from "./runtime/patterns/pattern.ts";
import type { Scope } from "./runtime/scope.ts";
import { type Span, spanFrom } from "./span.ts";

export enum MatchErrorCode {
  UnknownReference = "E_UNKNOWN_REFERENCE",
  UnknownParameter = "E_UNKNOWN_PARAMETER",
  PatternExpected = "E_PATTERN_EXPECTED",
  IterableExpected = "E_ITERABLE_EXPECTED",
  Type = "E_TYPE",
  NullValue = "E_NULL_VALUE",
  InvalidArgument = "E_INVALID_ARGUMENT",
  DuplicateVariable = "E_DUPLICATE_VARIABLE",
  IndirectLeftRecursion = "E_INDIRECT_LEFT_RECURSION",
}

export enum MatchKind {
  LR = "lr",
  Ok = "ok",
  Fail = "fail",
  Error = "error",
}

export type Match = MatchLR | MatchOk | MatchFail | MatchError;

export type MatchLR = {
  kind: MatchKind.LR;
  pattern: Pattern;
  scope: Scope;
};

export type MatchOk = {
  kind: MatchKind.Ok;
  pattern: Pattern;
  scope: Scope;
  span: Span;
  matches: Match[];
  value: unknown;
};

export type MatchFail = {
  kind: MatchKind.Fail;
  pattern: Pattern;
  scope: Scope;
  span: Span;
  matches: Match[];
};

export type MatchError = {
  kind: MatchKind.Error;
  pattern: Pattern;
  scope: Scope;
  span: Span;
  code: MatchErrorCode;
  message: string;
};

export function lr(scope: Scope, pattern: Pattern): MatchLR {
  return {
    kind: MatchKind.LR,
    pattern,
    scope,
  };
}

export function error(
  scope: Scope,
  pattern: Pattern,
  code: MatchErrorCode,
  message: string,
): MatchError {
  return {
    kind: MatchKind.Error,
    span: spanFrom(scope, scope),
    pattern,
    scope,
    code,
    message,
  };
}

export function ok(
  start: Scope,
  end: Scope,
  pattern: Pattern,
  value: unknown = undefined,
  matches: Match[] = [],
): MatchOk {
  return {
    kind: MatchKind.Ok,
    span: spanFrom(start, end),
    pattern,
    scope: end,
    value,
    matches,
  };
}

export function fail(
  scope: Scope,
  pattern: Pattern,
  matches: Match[] = [],
): MatchFail {
  return {
    kind: MatchKind.Fail,
    span: spanFrom(scope, scope),
    scope,
    pattern,
    matches,
  };
}

/**
 * Finds the "rightmost" failure in a MatchFail tree.
 * The rightmost failure is defined as the failure with the greatest start span.
 * This is useful for debugging match failures, as the rightmost failure typically
 * indicates where the problem occurred.
 *
 * @param match The MatchFail to search
 * @returns The rightmost MatchFail in the tree
 *
 * @example
 * ```ts
 * const result = match(pattern, scope);
 * if (result.kind === MatchKind.Fail) {
 *   const rightmost = getRightmostFailure(result);
 *   console.log(`Parse failed at position ${rightmost.span.start}`);
 * }
 * ```
 */
export function getRightmostFailure(match: MatchFail): MatchFail {
  let rightmost = match;

  // Recursively search through all child matches
  for (const child of match.matches) {
    if (child.kind === MatchKind.Fail) {
      // Recursively get the rightmost failure from this child
      const childRightmost = getRightmostFailure(child);

      // Compare start positions and keep the rightmost one
      if (childRightmost.span.start.compareTo(rightmost.span.start) > 0) {
        rightmost = childRightmost;
      }
    }
  }

  return rightmost;
}
