import type { Pattern } from "./runtime/patterns/pattern.ts";
import type { Scope } from "./runtime/scope.ts";
import type { Rule } from "./runtime/modules/mod.ts";
import {
  type SourceSpan,
  sourceSpansFrom,
  type Span,
  spanFrom,
} from "./span.ts";

export type { SourceSpan } from "./span.ts";

/**
 * Identifies the rule invocation (see `rule()` in `./runtime/rule.ts`) that
 * produced a memoized `MatchOk`/`MatchFail`. This is the "reverse" of a
 * packrat memo lookup: `rule()` already knows `(rule, args, position)` when
 * it asks `Memos` for a cached outcome, but a bare `Match` value on its own
 * does not otherwise record which rule (and resolved arguments) produced it.
 *
 * Recording `origin` lets a retained delivered-result tree (see
 * `.agents/specifications/runtime/memo-eviction.spec.md`'s delivered-result
 * reachability rule) be walked back into `(rule, args, position)` memo keys
 * for incremental re-parsing (see
 * `.agents/specifications/runtime/incremental-parsing.spec.md`), without
 * requiring the evicted `Memos` table itself to still exist.
 */
export type MatchOrigin = {
  rule: Rule;
  args: Map<string, Rule>;
};

export enum MatchErrorCode {
  UnknownReference = "E_UNKNOWN_REFERENCE",
  UnknownParameter = "E_UNKNOWN_PARAMETER",
  PatternExpected = "E_PATTERN_EXPECTED",
  IterableExpected = "E_ITERABLE_EXPECTED",
  Type = "E_TYPE",
  NullValue = "E_NULL_VALUE",
  InvalidArgument = "E_INVALID_ARGUMENT",
  InternalInvariant = "E_INTERNAL_INVARIANT",
  ModuleResolution = "E_MODULE_RESOLUTION",
  DuplicateVariable = "E_DUPLICATE_VARIABLE",
  IndirectLeftRecursion = "E_INDIRECT_LEFT_RECURSION",
  ExpressionException = "E_EXPRESSION_EXCEPTION",
}

export enum MatchKind {
  LR = "lr",
  Ok = "ok",
  Fail = "fail",
  Error = "error",
}

export type Match<T = unknown> = MatchLR | MatchOk<T> | MatchFail | MatchError;

export type MatchLR = {
  kind: MatchKind.LR;
  pattern: Pattern;
  scope: Scope;
};

export type MatchOk<T = unknown> = {
  kind: MatchKind.Ok;
  pattern: Pattern;
  scope: Scope;
  span: Span;
  normalizedSpan: SourceSpan;
  originalSpan: SourceSpan;
  matches: Match[];
  value: T;
  /** Set only for the Ok produced by a fresh rule invocation; see {@link MatchOrigin}. */
  origin?: MatchOrigin;
};

export type MatchFail = {
  kind: MatchKind.Fail;
  pattern: Pattern;
  scope: Scope;
  span: Span;
  normalizedSpan: SourceSpan;
  originalSpan: SourceSpan;
  matches: Match[];
  /** Set only for the Fail produced by a fresh rule invocation; see {@link MatchOrigin}. */
  origin?: MatchOrigin;
};

export type MatchError = {
  kind: MatchKind.Error;
  pattern: Pattern;
  scope: Scope;
  span: Span;
  normalizedSpan: SourceSpan;
  originalSpan: SourceSpan;
  code: MatchErrorCode;
  message: string;
  error?: Error;
  cause?: unknown;
};

export function isMatchError(value: unknown): value is MatchError {
  return value != null && typeof value === "object" &&
    (value as { kind?: unknown }).kind === MatchKind.Error;
}

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
  cause?: unknown,
): MatchError {
  const { normalizedSpan, originalSpan } = sourceSpansFrom(scope, scope);
  return {
    kind: MatchKind.Error,
    span: spanFrom(scope, scope),
    normalizedSpan,
    originalSpan,
    pattern,
    scope,
    code,
    message,
    error: cause instanceof Error ? cause : undefined,
    cause,
  };
}

export function ok(
  start: Scope,
  end: Scope,
  pattern: Pattern,
  value: unknown = undefined,
  matches: Match[] = [],
  origin?: MatchOrigin,
): MatchOk {
  const { normalizedSpan, originalSpan } = sourceSpansFrom(start, end);
  return {
    kind: MatchKind.Ok,
    span: spanFrom(start, end),
    normalizedSpan,
    originalSpan,
    pattern,
    scope: end,
    value,
    matches,
    origin,
  };
}

export function fail(
  scope: Scope,
  pattern: Pattern,
  matches: Match[] = [],
  origin?: MatchOrigin,
): MatchFail {
  const { normalizedSpan, originalSpan } = sourceSpansFrom(scope, scope);
  return {
    kind: MatchKind.Fail,
    span: spanFrom(scope, scope),
    normalizedSpan,
    originalSpan,
    scope,
    pattern,
    matches,
    origin,
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
/**
 * Finds the "rightmost" failure in a MatchFail tree.
 * The rightmost failure is defined as the failure with the greatest start span.
 * This is useful for debugging match failures, as the rightmost failure typically
 * indicates where the problem occurred.
 *
 * Failed alternatives recorded under Ok parents (for example Or) are included.
 */
export function getRightmostFailure(match: MatchFail): MatchFail {
  let rightmost = match;

  const visit = (node: Match): void => {
    if (node.kind === MatchKind.Fail) {
      if (node.span.start.compareTo(rightmost.span.start) > 0) {
        rightmost = node;
      }
      for (const child of node.matches) visit(child);
      return;
    }
    if (node.kind === MatchKind.Ok) {
      for (const child of node.matches) visit(child);
    }
  };

  for (const child of match.matches) visit(child);
  return rightmost;
}
