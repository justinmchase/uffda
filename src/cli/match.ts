import {
  getRightmostFailure,
  isSuccess,
  type Match,
  MatchKind,
} from "../match.ts";
import { matchWithRecovery } from "../runtime/recovery.ts";
import { diagnoseRecoveries } from "../match.recovery_diagnostics.ts";
import type { SourceSpan } from "../span.ts";
import { InputNormalizationMode } from "../input.ts";
import { isPattern, type Pattern } from "../runtime/patterns/pattern.ts";
import { Scope } from "../runtime/scope.ts";
import { valueOf } from "../match.ts";

export enum CliMatchFailureCode {
  InvalidJson = "CLI_MATCH_INVALID_JSON",
  UnsupportedAst = "CLI_MATCH_UNSUPPORTED_AST",
  MatchFailure = "CLI_MATCH_FAILURE",
  /** Input the match skipped by recovering; see error-recovery.spec.md. */
  Recovered = "CLI_MATCH_RECOVERED",
}

export type CliMatchFailure = {
  code: CliMatchFailureCode;
  phase: "input" | "parse" | "match";
  message: string;
  inputPosition?: string;
  inputDescription?: string;
  source?: string;
  sourceOffset?: number;
  /** Source offsets of the input a recovery skipped. */
  inputSpan?: SourceSpan;
};

export function isCliMatchFailure(value: unknown): value is CliMatchFailure {
  if (value == null || typeof value !== "object") return false;

  const failure = value as Partial<CliMatchFailure>;
  return Object.values(CliMatchFailureCode).includes(
    failure.code as CliMatchFailureCode,
  ) && (failure.phase === "input" || failure.phase === "parse" ||
    failure.phase === "match") &&
    typeof failure.message === "string";
}

export type CliMatchResult =
  | { ok: true; value: unknown }
  | {
    ok: false;
    /** The failure, or the first recovery of a recovered match. */
    error: CliMatchFailure;
    /**
     * Every diagnostic of a match that ran, in document order: one per
     * recovery, then the match failure when it failed.
     */
    diagnostics?: CliMatchFailure[];
    /** The value of a match that succeeded only by recovering. */
    value?: unknown;
  };

function sourceOffset(
  source: string | undefined,
  pattern: Pattern,
): number | undefined {
  if (source === undefined) return undefined;

  if (pattern.kind === "over") return source.indexOf("{");
  return undefined;
}

async function matchFailure(
  result: Match,
  source?: string,
): Promise<CliMatchFailure> {
  switch (result.kind) {
    case MatchKind.Error:
      return {
        code: CliMatchFailureCode.MatchFailure,
        phase: "match",
        message: `${result.code}: ${result.message}`,
      };
    case MatchKind.Fail: {
      const rightmost = getRightmostFailure(result);
      return {
        code: CliMatchFailureCode.MatchFailure,
        phase: "match",
        message:
          `Pattern '${rightmost.pattern.kind}' did not match input at ${rightmost.span.start.toString()}`,
        inputPosition: rightmost.span.start.toString(),
        inputDescription: await rightmost.scope.stream.done()
          ? "end of input"
          : "a value that did not match",
        source,
        sourceOffset: sourceOffset(source, rightmost.pattern),
      };
    }
    case MatchKind.LR:
      return {
        code: CliMatchFailureCode.MatchFailure,
        phase: "match",
        message: "match failed with left recursion outcome",
      };
    case MatchKind.Ok:
    case MatchKind.Skip:
      throw new Error("Expected match failure");
  }
}

export async function matchCliPattern(
  value: unknown,
  input: unknown,
  jsonInput = false,
  source?: string,
): Promise<CliMatchResult> {
  if (!isPattern(value)) {
    return {
      ok: false,
      error: {
        code: CliMatchFailureCode.UnsupportedAst,
        phase: "parse",
        message: "Expected a raw pattern AST",
      },
    };
  }

  const result = await matchWithRecovery(
    value as Pattern,
    Scope.From(input, {
      kind: jsonInput
        ? InputNormalizationMode.Scalar
        : InputNormalizationMode.Iterable,
    }),
  );
  if (isSuccess(result) && !result.recovered) {
    return { ok: true, value: valueOf(result) };
  }
  const recoveries: CliMatchFailure[] = (await diagnoseRecoveries(result))
    .map(({ span, message }) => ({
      code: CliMatchFailureCode.Recovered,
      phase: "match",
      message,
      inputSpan: span,
    }));
  if (isSuccess(result)) {
    return {
      ok: false,
      error: recoveries[0],
      diagnostics: recoveries,
      value: valueOf(result),
    };
  }
  const failure = await matchFailure(result, source);
  return { ok: false, error: failure, diagnostics: [...recoveries, failure] };
}

export function parseCliMatchInput(
  source: string,
  jsonInput: boolean,
): { ok: true; value: unknown } | { ok: false; error: CliMatchFailure } {
  if (!jsonInput) return { ok: true, value: source };

  try {
    return { ok: true, value: JSON.parse(source) };
  } catch (error) {
    return {
      ok: false,
      error: {
        code: CliMatchFailureCode.InvalidJson,
        phase: "input",
        message: error instanceof Error ? error.message : String(error),
      },
    };
  }
}
