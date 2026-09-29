import type { Pattern } from "./runtime/patterns/pattern.ts";
import type { Scope } from "./runtime/scope.ts";
import type { Rule } from "./runtime/modules/mod.ts";
import {
  type SourceSpan,
  sourceSpanFrom,
  type Span,
  spanFrom,
} from "./span.ts";
import { unwrap, wrapFrom, type Wrapped } from "./wrapped.ts";

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
  /**
   * Set when the invocation's outcome observed an in-progress left-recursive
   * seed at its start position. Such an outcome is only valid as part of that
   * growth, so it is never reused on its own; see
   * `.agents/specifications/runtime/left-recursion.spec.md`.
   */
  seeded?: true;
  /**
   * Set when the invocation ran with recovery enabled; part of its memo key
   * (see `.agents/specifications/runtime/error-recovery.spec.md`).
   */
  recovery?: true;
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
  ExpressionException = "E_EXPRESSION_EXCEPTION",
}

export enum MatchKind {
  LR = "lr",
  Ok = "ok",
  Skip = "skip",
  Fail = "fail",
  Error = "error",
}

export type Match<T = unknown> =
  | MatchLR
  | MatchOk<T>
  | MatchSkip
  | MatchFail
  | MatchError;

/**
 * A success, ordinary or skipped. Both recognize input and carry a resulting
 * scope; see `.agents/specifications/patterns/pattern-matching.spec.md`.
 */
export type MatchSuccess<T = unknown> = MatchOk<T> | MatchSkip;

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
  originalSpan: SourceSpan;
  matches: Match[];
  /** Carried as a wrapped value; see `./wrapped.ts`. */
  value: Wrapped<T>;
  /** Set only for the Ok produced by a fresh rule invocation; see {@link MatchOrigin}. */
  origin?: MatchOrigin;
  /**
   * When set, `this` (see `reference()`) resolves to this value instead of
   * the `MatchOk` itself. Used only for decorator invocation, where `this`
   * must resolve to the `Rule`/`Func` being decorated rather than to the
   * decorator's own args-match; see
   * `.agents/specifications/runtime/rule-metadata.spec.md`. Absent for every
   * ordinary match-time evaluation.
   */
  subject?: unknown;
  /**
   * Set when this match is a recovery, or accepted one as a successful child;
   * see `.agents/specifications/runtime/error-recovery.spec.md#recovered-matches`.
   */
  recovered?: true;
};

/**
 * A success that contributes no value: sequences and repetitions omit it from
 * what they collect. Its value is always `undefined`; see
 * `.agents/specifications/patterns/runtime/skip.spec.md`.
 */
export type MatchSkip = Omit<MatchOk<undefined>, "kind"> & {
  kind: MatchKind.Skip;
};

export type MatchFail = {
  kind: MatchKind.Fail;
  pattern: Pattern;
  scope: Scope;
  span: Span;
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
  originalSpan: SourceSpan;
  code: MatchErrorCode;
  message: string;
  error?: Error;
  cause?: unknown;
};

export function isSuccess<M extends Match>(
  match: M,
): match is Extract<M, { kind: MatchKind.Ok | MatchKind.Skip }> {
  return match.kind === MatchKind.Ok || match.kind === MatchKind.Skip;
}

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
  const originalSpan = sourceSpanFrom(scope, scope);
  return {
    kind: MatchKind.Error,
    span: spanFrom(scope, scope),
    originalSpan,
    pattern,
    scope,
    code,
    message,
    error: cause instanceof Error ? cause : undefined,
    cause,
  };
}

// Replaced before `ok()` returns; the match must exist to be its value's origin.
const PENDING = undefined as unknown as Wrapped;

export function ok(
  start: Scope,
  end: Scope,
  pattern: Pattern,
  value: unknown = undefined,
  matches: Match[] = [],
  origin?: MatchOrigin,
): MatchOk {
  const originalSpan = sourceSpanFrom(start, end);
  const m: MatchOk = {
    kind: MatchKind.Ok,
    span: spanFrom(start, end),
    originalSpan,
    pattern,
    scope: end,
    value: PENDING,
    matches,
    origin,
  };
  // A value that is not already carried was computed by this match, so it
  // takes this match's span as its origin.
  m.value = wrapFrom(value, m);
  if (start.recovery && matches.some(isRecovered)) m.recovered = true;
  return m;
}

/** A skipped success spanning `start` to `end`; its value is `undefined`. */
export function skip(
  start: Scope,
  end: Scope,
  pattern: Pattern,
  matches: Match[] = [],
  origin?: MatchOrigin,
): MatchSkip {
  const m: MatchSkip = {
    kind: MatchKind.Skip,
    span: spanFrom(start, end),
    originalSpan: sourceSpanFrom(start, end),
    pattern,
    scope: end,
    value: PENDING as Wrapped<undefined>,
    matches,
    origin,
  };
  m.value = wrapFrom(undefined, m) as Wrapped<undefined>;
  if (start.recovery && matches.some(isRecovered)) m.recovered = true;
  return m;
}

/** Whether `match` is a success that is, or accepted, a recovery. */
export function isRecovered(match: Match): match is MatchSuccess {
  return isSuccess(match) && match.recovered === true;
}

/**
 * A success whose value is exactly `child`'s: skipped when `child` was
 * skipped, otherwise ordinary with `child`'s value.
 */
export function forward(
  start: Scope,
  end: Scope,
  pattern: Pattern,
  child: MatchSuccess,
  matches: Match[] = [child],
  origin?: MatchOrigin,
): MatchSuccess {
  return child.kind === MatchKind.Skip
    ? skip(start, end, pattern, matches, origin)
    : ok(start, end, pattern, child.value, matches, origin);
}

/** The fully raw value of `match`, for host code (see `unwrap`). */
export function valueOf<T>(match: MatchSuccess<T>): T {
  return unwrap(match.value) as T;
}

export function fail(
  scope: Scope,
  pattern: Pattern,
  matches: Match[] = [],
  origin?: MatchOrigin,
): MatchFail {
  const originalSpan = sourceSpanFrom(scope, scope);
  return {
    kind: MatchKind.Fail,
    span: spanFrom(scope, scope),
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
  const seen = new Set<Match>();

  const visit = (node: Match): void => {
    if (seen.has(node)) return;
    seen.add(node);
    if (node.kind === MatchKind.Fail) {
      if (node.span.start.compareTo(rightmost.span.start) > 0) {
        rightmost = node;
      }
      for (const child of node.matches) visit(child);
      return;
    }
    if (isSuccess(node)) {
      for (const child of node.matches) visit(child);
    }
  };

  for (const child of match.matches) visit(child);
  return rightmost;
}
