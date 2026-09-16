import { expressionGrammar } from "../lang/expression/expression.lang.ts";
import type { Expression } from "../runtime/expressions/expression.ts";
import { getRightmostFailure, type Match, MatchKind } from "../match.ts";
import {
  analyzeMatchFailure,
  formatMatchFailureSummary,
} from "../match.visualize.ts";
import { patternGrammar } from "../lang/pattern/pattern.lang.ts";
import type { Pattern } from "../runtime/patterns/pattern.ts";
import {
  uffdaGrammar,
  type UffdaSyntaxModule,
} from "../lang/uffda/uffda.lang.ts";
import { CliLanguage } from "./contract.ts";
import type { Input } from "../input.ts";
import type { Memos } from "../memo.ts";

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
  /**
   * Exclusive end offset of the unexpected token when known (so editors can
   * underline the whole token). Omitted for end-of-input / point failures.
   */
  endOffset?: number;
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
    /**
     * The raw, successful `Match` this AST was extracted from. Present so
     * callers doing incremental re-parsing (see
     * `.agents/specifications/runtime/incremental-parsing.spec.md`) can
     * retain it as the "prior parse" fed into `rehydrateMemos` for a later
     * edit, without this module needing any incremental-specific return
     * shape of its own. Unused by ordinary one-shot callers.
     */
    match: Match;
  }
  | {
    ok: false;
    error: CliStreamFailure;
    /**
     * The raw `Match` tree that produced this failure (`Fail`/`Error`/`LR`).
     * Present so consumers that derive editor features from the parse tree
     * (LSP semantic tokens, see
     * `.agents/requirements/cli-language-server/005-syntax-highlighting.requirement.md`)
     * can still classify spans matched before the failure point, rather than
     * blanking out highlighting for the whole document.
     */
    match: Match;
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

export async function parseFailureMessage(match: Match): Promise<string> {
  if (match.kind === MatchKind.Error) {
    return `${match.code}: ${match.message}`;
  }
  if (match.kind === MatchKind.Fail) {
    const analysis = await analyzeMatchFailure(match);
    if (analysis) return formatMatchFailureSummary(analysis);
    // Fallback if analysis finds no candidate (should be rare for Fail).
    return "Expected input\nUnexpected failure";
  }
  if (match.kind === MatchKind.LR) {
    return "parse failed with left recursion outcome";
  }
  return "unexpected parser outcome";
}

function locationFromAnalysis(
  sourceText: string,
  analysis: Awaited<ReturnType<typeof analyzeMatchFailure>>,
  match: Match,
): CliStreamFailureLocation {
  if (analysis && analysis.sourceOffset >= 0) {
    const start = locationFromOffset(sourceText, analysis.sourceOffset);
    if (analysis.unexpectedLength > 0) {
      return {
        ...start,
        endOffset: Math.min(
          sourceText.length,
          analysis.sourceOffset + analysis.unexpectedLength,
        ),
      };
    }
    return start;
  }
  return locationFromOffset(
    sourceText,
    sourceOffsetFromMatch(match, sourceText),
  );
}

async function toParseFailure(
  match: Match,
  language: CliLanguage,
  sourcePath: string,
  sourceText: string,
): Promise<CliStreamResult> {
  const analysis = match.kind === MatchKind.Fail
    ? await analyzeMatchFailure(match)
    : undefined;
  return {
    ok: false,
    error: {
      code: CliStreamFailureCode.ParseFailure,
      phase: "parse",
      sourcePath,
      language,
      message: analysis
        ? formatMatchFailureSummary(analysis)
        : await parseFailureMessage(match),
      location: locationFromAnalysis(sourceText, analysis, match),
    },
    match,
  };
}

/** Options threaded through to the underlying grammar for incremental
 * re-parsing (see `GrammarOptions` in `../lang/grammar.ts`): a pre-seeded
 * memo table (typically from `rehydrateMemos`) plus the exact `Input` chain
 * it was rehydrated against. Only meaningful for `CliLanguage.FullUffda`,
 * the only language a session's incremental patch tool re-parses. */
export type CliStreamIncrementalOptions = {
  memos?: Memos;
  input?: Input;
};

export async function parseSourceToAst(
  sourceText: string,
  language: CliLanguage = CliLanguage.FullUffda,
  sourcePath = "<stdin>",
  incremental?: CliStreamIncrementalOptions,
): Promise<CliStreamResult> {
  switch (language) {
    case CliLanguage.FullUffda: {
      const parsed = await uffdaGrammar(sourceText, incremental);
      return parsed.kind === MatchKind.Ok
        ? { ok: true, ast: parsed.value, match: parsed }
        : await toParseFailure(parsed, language, sourcePath, sourceText);
    }
    case CliLanguage.Pattern: {
      const parsed = await patternGrammar(sourceText);
      return parsed.kind === MatchKind.Ok
        ? { ok: true, ast: parsed.value, match: parsed }
        : await toParseFailure(parsed, language, sourcePath, sourceText);
    }
    case CliLanguage.Expression: {
      const parsed = await expressionGrammar(sourceText);
      return parsed.kind === MatchKind.Ok
        ? { ok: true, ast: parsed.value, match: parsed }
        : await toParseFailure(parsed, language, sourcePath, sourceText);
    }
  }
}

export async function compileStdinToArtifact(
  sourceText: string,
  language: CliLanguage = CliLanguage.FullUffda,
): Promise<CliStreamResult> {
  return await parseSourceToAst(sourceText, language);
}
