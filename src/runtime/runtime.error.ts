import { Match } from "../match.ts";
import { IModule, IRule } from "../modules.ts";
import { Expression } from "./expressions/expression.ts";
import { Pattern } from "./patterns/pattern.ts";

export enum RuntimeErrorCode {
  Unknown = "E_UNKNOWN",
  IndirectLeftRecursion = "E_INDIRECT_LEFT_RECURSION",
  PatternNotFound = "E_PATTERN_NOT_FOUND",
  PatternUnmatched = "E_PATTERN_UNMATCHED",
  StreamIncomplete = "E_STREAM_INCOMPLETE",
  MatchError = "E_MATCH_ERROR",
  InvalidExpression = "E_INVALID_EXPRESSION",
  UnknownReference = "E_UNKNOWN_REFERENCE",
}

export const RuntimeErrorMessages = {
  [RuntimeErrorCode.Unknown]: () => "An unknown error occurred",
  [RuntimeErrorCode.IndirectLeftRecursion]: () =>
    "Left recursion was detected but no rules are in the stack",
  [RuntimeErrorCode.PatternNotFound]: ({ name = "unknown" }) =>
    `A pattern (${name}) was referenced but not found`,
  [RuntimeErrorCode.PatternUnmatched]: () => "Input failed to match pattern",
  [RuntimeErrorCode.StreamIncomplete]: () =>
    "Pattern failed to read entire stream",
  [RuntimeErrorCode.MatchError]: () =>
    "A pattern match operation produced one or more errors",
  [RuntimeErrorCode.InvalidExpression]: () =>
    "An expression is invalid",
  [RuntimeErrorCode.UnknownReference]: ({ name = "unknown" }) => 
    `Unable to resolve reference ${name}`
};

export class RuntimeError extends Error {
  private readonly metadata?: Record<string, unknown>;
  constructor(
    public readonly code: RuntimeErrorCode,
    public readonly module?: IModule,
    public readonly rule?: IRule,
    public readonly op?: Pattern | Expression,
    public readonly match?: Match,
    public options?:
      | ErrorOptions & { metadata?: Record<string, unknown> }
      | undefined,
  ) {
    const { metadata, cause } = options ?? {};
    super(RuntimeErrorMessages[code](options?.metadata ?? {}), { cause });
    this.metadata = metadata;
  }
}
