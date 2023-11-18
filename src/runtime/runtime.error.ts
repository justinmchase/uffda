import { black } from "std/fmt/colors.ts";
import { Match } from "../match.ts";
import { Module, Rule } from "./modules/mod.ts";
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
  UnknownSpecialKind = "E_UNKNOWN_SPECIAL_KIND",
  UnknownPatternKind = "E_UNKNOWN_PATTERN_KIND",
}

type RuntimeErrorArgs = {
  mod?: Module;
  rule?: Rule;
  op?: Pattern | Expression;
  match?: Match;
  metadata?: Record<string, unknown>;
};

export const RuntimeErrorMessages = {
  [RuntimeErrorCode.Unknown]: () => "An unknown error occurred",
  [RuntimeErrorCode.IndirectLeftRecursion]: () =>
    "Left recursion was detected but no rules are in the stack",
  [RuntimeErrorCode.PatternNotFound]: (
    { metadata: { name = "unknown" } = {}, mod }: RuntimeErrorArgs,
  ) => `A pattern (${name}) was referenced but not found in ${mod?.moduleUrl}`,
  [RuntimeErrorCode.PatternUnmatched]: () => "Input failed to match pattern",
  [RuntimeErrorCode.StreamIncomplete]: (
    { match = Match.Default() }: RuntimeErrorArgs,
  ) =>
    `Pattern failed to read entire stream [${
      black(match.end.stream.path.toString())
    }]`,
  [RuntimeErrorCode.MatchError]: () =>
    "A pattern match operation produced one or more errors",
  [RuntimeErrorCode.InvalidExpression]: () => "An expression is invalid",
  [RuntimeErrorCode.UnknownReference]: (
    { metadata: { name = "unknown" } = {} },
  ) => `Unable to resolve reference ${name}`,
  [RuntimeErrorCode.UnknownSpecialKind]: (
    { metadata: { kind = "unknown", name = "unknown" } = {} }: RuntimeErrorArgs,
  ) => `Unknown special kind [${kind}] for (${name})`,
  [RuntimeErrorCode.UnknownPatternKind]: (
    { metadata: { kind = "unknown" } = {} }: RuntimeErrorArgs,
  ) => `Unknown pattern kind [${kind}]`,
};

export class RuntimeError extends Error {
  private readonly metadata?: Record<string, unknown>;
  constructor(
    public readonly code: RuntimeErrorCode,
    public readonly module?: Module,
    public readonly rule?: Rule,
    public readonly op?: Pattern | Expression,
    public readonly match?: Match,
    public options?:
      | ErrorOptions & { metadata?: Record<string, unknown> }
      | undefined,
  ) {
    const { metadata, cause } = options ?? {};
    const args = {
      mod: module,
      rule,
      op,
      match,
      metadata: options?.metadata,
    };
    super(`${code} ${RuntimeErrorMessages[code](args)}`, { cause });
    this.metadata = metadata;
  }
}
