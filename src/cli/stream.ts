import { expressionGrammar } from "../lang/expression/expression.lang.ts";
import type { Expression } from "../runtime/expressions/expression.ts";
import { getRightmostFailure, type Match, MatchKind } from "../match.ts";
import { patternGrammar } from "../lang/pattern/pattern.lang.ts";
import type { Pattern } from "../runtime/patterns/pattern.ts";
import {
  uffdaGrammar,
  type UffdaSyntaxModule,
} from "../lang/uffda/uffda.lang.ts";
import { CliLanguage } from "./contract.ts";

export enum CliStreamFailureCode {
  ParseFailure = "CLI_STREAM_PARSE_FAILURE",
}

export type CliStreamFailureLocation = {
  /** Absolute character offset into the authored source. */
  offset: number;
  /** 0-based line index. */
  line: number;
  /** 0-based column index within the line. */
  column: number;
};

export type CliStreamFailure = {
  code: CliStreamFailureCode;
  phase: "parse";
  sourcePath: string;
  language: CliLanguage;
  message: string;
  location?: CliStreamFailureLocation;
};

export type CliStreamResult =
  | {
    ok: true;
    ast: UffdaSyntaxModule | Pattern | Expression;
  }
  | {
    ok: false;
    error: CliStreamFailure;
  };

export function locationFromOffset(
  source: string,
  offset: number,
): CliStreamFailureLocation {
  const safe = Math.max(0, Math.min(offset, source.length));
  const before = source.slice(0, safe);
  const lines = before.split("\n");
  return {
    offset: safe,
    line: lines.length - 1,
    column: lines.at(-1)?.length ?? 0,
  };
}

function sourceOffsetFromMatch(match: Match, source: string): number {
  if (match.kind !== MatchKind.Fail && match.kind !== MatchKind.Error) {
    return source.length;
  }

  const focus = match.kind === MatchKind.Fail
    ? getRightmostFailure(match)
    : match;

  const offset = focus.originalSpan.start;
  if (
    typeof offset === "number" &&
    offset >= 0 &&
    offset <= source.length
  ) {
    return offset;
  }

  return source.length;
}

function describeUnexpected(match: Match): string {
  if (match.kind !== MatchKind.Fail && match.kind !== MatchKind.Error) {
    return "unexpected input";
  }
  const focus = match.kind === MatchKind.Fail
    ? getRightmostFailure(match)
    : match;
  if (focus.scope.stream.done) return "end of input";
  const value = focus.scope.stream.value;
  if (typeof value === "string") return JSON.stringify(value);
  if (value === undefined) return "missing input";
  return Deno.inspect(value, {
    colors: false,
    depth: 1,
    strAbbreviateSize: 40,
  });
}

export function parseFailureMessage(match: Match): string {
  if (match.kind === MatchKind.Error) {
    return `${match.code}: ${match.message}`;
  }
  if (match.kind === MatchKind.Fail) {
    const rightmost = getRightmostFailure(match);
    return `unexpected ${
      describeUnexpected(rightmost)
    } while matching ${rightmost.pattern.kind}`;
  }
  if (match.kind === MatchKind.LR) {
    return "parse failed with left recursion outcome";
  }
  return "unexpected parser outcome";
}

function toParseFailure(
  match: Match,
  language: CliLanguage,
  sourcePath: string,
  sourceText: string,
): CliStreamResult {
  return {
    ok: false,
    error: {
      code: CliStreamFailureCode.ParseFailure,
      phase: "parse",
      sourcePath,
      language,
      message: parseFailureMessage(match),
      location: locationFromOffset(
        sourceText,
        sourceOffsetFromMatch(match, sourceText),
      ),
    },
  };
}

export async function parseSourceToAst(
  sourceText: string,
  language: CliLanguage = CliLanguage.FullUffda,
  sourcePath = "<stdin>",
): Promise<CliStreamResult> {
  switch (language) {
    case CliLanguage.FullUffda: {
      const parsed = await uffdaGrammar(sourceText);
      return parsed.kind === MatchKind.Ok
        ? { ok: true, ast: parsed.value }
        : toParseFailure(parsed, language, sourcePath, sourceText);
    }
    case CliLanguage.Pattern: {
      const parsed = await patternGrammar(sourceText);
      return parsed.kind === MatchKind.Ok
        ? { ok: true, ast: parsed.value }
        : toParseFailure(parsed, language, sourcePath, sourceText);
    }
    case CliLanguage.Expression: {
      const parsed = await expressionGrammar(sourceText);
      return parsed.kind === MatchKind.Ok
        ? { ok: true, ast: parsed.value }
        : toParseFailure(parsed, language, sourcePath, sourceText);
    }
  }
}

export async function compileStdinToArtifact(
  sourceText: string,
  language: CliLanguage = CliLanguage.FullUffda,
): Promise<CliStreamResult> {
  return await parseSourceToAst(sourceText, language);
}
