import { expressionGrammar } from "../lang/expression/expression.lang.ts";
import type { Expression } from "../runtime/expressions/expression.ts";
import { type Match, MatchKind } from "../match.ts";
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

export type CliStreamFailure = {
  code: CliStreamFailureCode;
  phase: "parse";
  sourcePath: string;
  language: CliLanguage;
  message: string;
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

function parseFailureMessage(match: Match): string {
  if (match.kind === MatchKind.Error) {
    return `${match.code}: ${match.message}`;
  }
  if (match.kind === MatchKind.Fail) {
    return `parse failed at ${match.span.start.toString()}`;
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
): CliStreamResult {
  return {
    ok: false,
    error: {
      code: CliStreamFailureCode.ParseFailure,
      phase: "parse",
      sourcePath,
      language,
      message: parseFailureMessage(match),
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
        : toParseFailure(parsed, language, sourcePath);
    }
    case CliLanguage.Pattern: {
      const parsed = await patternGrammar(sourceText);
      return parsed.kind === MatchKind.Ok
        ? { ok: true, ast: parsed.value }
        : toParseFailure(parsed, language, sourcePath);
    }
    case CliLanguage.Expression: {
      const parsed = await expressionGrammar(sourceText);
      return parsed.kind === MatchKind.Ok
        ? { ok: true, ast: parsed.value }
        : toParseFailure(parsed, language, sourcePath);
    }
  }
}

export async function compileStdinToArtifact(
  sourceText: string,
  language: CliLanguage = CliLanguage.FullUffda,
): Promise<CliStreamResult> {
  return await parseSourceToAst(sourceText, language);
}
