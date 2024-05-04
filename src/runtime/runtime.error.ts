import { Scope } from "./scope.ts";

export enum RuntimeErrorCode {
  Unknown = "E_UNKNOWN",
  IndirectLeftRecursion = "E_INDIRECT_LEFT_RECURSION",
  PatternNotFound = "E_PATTERN_NOT_FOUND",
  PatternUnmatched = "E_PATTERN_UNMATCHED",
  MatchError = "E_MATCH_ERROR",
  InvalidExpression = "E_INVALID_EXPRESSION",
  UnknownReference = "E_UNKNOWN_REFERENCE",
  UnknownSpecialKind = "E_UNKNOWN_SPECIAL_KIND",
  UnknownPatternKind = "E_UNKNOWN_PATTERN_KIND",
}

type RuntimeErrorArgs = {
  scope: Scope;
  metadata: Record<string, unknown>;
};

export const RuntimeErrorMessages = {
  [RuntimeErrorCode.Unknown]: () => "An unknown error occurred",
  [RuntimeErrorCode.IndirectLeftRecursion]: () =>
    "Left recursion was detected but no rules are in the stack",
  [RuntimeErrorCode.PatternNotFound]: (
    { metadata: { name = "unknown" }, scope }: RuntimeErrorArgs,
  ) =>
    `A pattern (${name}) was referenced but not found in ${scope.module.moduleUrl}`,
  [RuntimeErrorCode.PatternUnmatched]: () => "Input failed to match pattern",
  [RuntimeErrorCode.MatchError]: () =>
    "A pattern match operation produced one or more errors",
  [RuntimeErrorCode.InvalidExpression]: () => "An expression is invalid",
  [RuntimeErrorCode.UnknownReference]: (
    { metadata: { name = "unknown" } },
  ) => `Unable to resolve reference ${name}`,
  [RuntimeErrorCode.UnknownSpecialKind]: (
    { metadata: { kind = "unknown", name = "unknown" } }: RuntimeErrorArgs,
  ) => `Unknown special kind [${kind}] for (${name})`,
  [RuntimeErrorCode.UnknownPatternKind]: (
    { metadata: { kind = "unknown" } = {} }: RuntimeErrorArgs,
  ) => `Unknown pattern kind [${kind}]`,
};

export class RuntimeError extends Error {
  public readonly metadata: Record<string, unknown>;
  constructor(
    public readonly code: RuntimeErrorCode,
    public readonly scope: Scope,
    public options?: ErrorOptions & { metadata?: Record<string, unknown> },
  ) {
    const { metadata = {}, cause } = options ?? {};
    const args = {
      scope: scope ?? Scope.Default(),
      metadata,
    };
    super(`${code} ${RuntimeErrorMessages[code](args)}`, { cause });
    this.metadata = metadata;
  }
}
