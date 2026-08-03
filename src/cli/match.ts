import { getRightmostFailure, type Match, MatchKind } from "../match.ts";
import { match } from "../runtime/match.ts";
import { InputNormalizationMode } from "../input.ts";
import { isPattern, type Pattern } from "../runtime/patterns/pattern.ts";
import { Scope } from "../runtime/scope.ts";

export enum CliMatchFailureCode {
  InvalidJson = "CLI_MATCH_INVALID_JSON",
  UnsupportedAst = "CLI_MATCH_UNSUPPORTED_AST",
  MatchFailure = "CLI_MATCH_FAILURE",
}

export type CliMatchFailure = {
  code: CliMatchFailureCode;
  phase: "input" | "parse" | "match";
  message: string;
  inputPosition?: string;
  inputDescription?: string;
  source?: string;
  sourceOffset?: number;
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
    error: CliMatchFailure;
  };

function sourceOffset(
  source: string | undefined,
  pattern: Pattern,
): number | undefined {
  if (source === undefined) return undefined;

  if (pattern.kind === "over") return source.indexOf("{");
  return undefined;
}

function matchFailure(result: Match, source?: string): CliMatchResult {
  switch (result.kind) {
    case MatchKind.Error:
      return {
        ok: false,
        error: {
          code: CliMatchFailureCode.MatchFailure,
          phase: "match",
          message: `${result.code}: ${result.message}`,
        },
      };
    case MatchKind.Fail: {
      const rightmost = getRightmostFailure(result);
      return {
        ok: false,
        error: {
          code: CliMatchFailureCode.MatchFailure,
          phase: "match",
          message:
            `Pattern '${rightmost.pattern.kind}' did not match input at ${rightmost.span.start.toString()}`,
          inputPosition: rightmost.span.start.toString(),
          inputDescription: rightmost.scope.stream.done
            ? "end of input"
            : "a value that did not match",
          source,
          sourceOffset: sourceOffset(source, rightmost.pattern),
        },
      };
    }
    case MatchKind.LR:
      return {
        ok: false,
        error: {
          code: CliMatchFailureCode.MatchFailure,
          phase: "match",
          message: "match failed with left recursion outcome",
        },
      };
    case MatchKind.Ok:
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

  const result = await match(
    value as Pattern,
    Scope.From(input, {
      kind: jsonInput
        ? InputNormalizationMode.Scalar
        : InputNormalizationMode.Iterable,
    }),
  );
  return result.kind === MatchKind.Ok
    ? { ok: true, value: result.value }
    : matchFailure(result, source);
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
