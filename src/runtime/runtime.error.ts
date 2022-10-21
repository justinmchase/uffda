import { Match } from "../match.ts";
import { Pattern } from "./patterns/pattern.ts";

export enum RuntimeErrorCode {
  Unknown = "E_UNKNOWN",
  PatternUnmatched = "E_PATTERN_UNMATCHED",
  StreamIncomplete = "E_STREAM_INCOMPLETE",
  MatchError = "E_MATCH_ERROR",
}

export const RuntimeErrorMessages = {
  [RuntimeErrorCode.Unknown]: "An unknown error occurred",
  [RuntimeErrorCode.PatternUnmatched]: "Input failed to match pattern",
  [RuntimeErrorCode.StreamIncomplete]: "Pattern failed to read entire stream",
  [RuntimeErrorCode.MatchError]:
    "A pattern match operation produced one or more errors",
};

export class RuntimeError extends Error {
  constructor(
    public readonly code: RuntimeErrorCode,
    public readonly pattern: Pattern,
    public readonly match: Match,
    public options?: ErrorOptions | undefined,
  ) {
    super(RuntimeErrorMessages[code], options);
  }
}
