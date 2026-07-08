import { assertEquals } from "@std/assert";
import { MatchKind, type Match, type MatchOk } from "../match.ts";

export type GrammarParse<TAst, TOptions> = (
  source: string,
  options?: TOptions,
) => Promise<Match<TAst>>;

export type GrammarEvaluate<TAst, TResult> = (
  ast: TAst,
  match: MatchOk<TAst>,
) => Promise<TResult>;

export type GrammarCase<TAst, TResult, TOptions> = {
  syntax: string;
  expectedAst: TAst;
  expectedValue: TResult;
  options?: TOptions;
};

export type GrammarRunResult<TAst, TResult> =
  | {
    kind: "match";
    match: Match<TAst>;
  }
  | {
    kind: "result";
    match: MatchOk<TAst>;
    result: TResult;
  };

export function createGrammarRunner<TAst, TResult, TOptions>(
  parse: GrammarParse<TAst, TOptions>,
  evaluate: GrammarEvaluate<TAst, TResult>,
) {
  return async (
    source: string,
    options?: TOptions,
  ): Promise<GrammarRunResult<TAst, TResult>> => {
    const match = await parse(source, options);
    if (match.kind !== MatchKind.Ok) {
      return {
        kind: "match",
        match,
      };
    }
    return {
      kind: "result",
      match,
      result: await evaluate(match.value, match),
    };
  };
}

export async function assertGrammarCases<TAst, TResult, TOptions>(options: {
  parse: GrammarParse<TAst, TOptions>;
  evaluate: GrammarEvaluate<TAst, TResult>;
  cases: GrammarCase<TAst, TResult, TOptions>[];
  options?: TOptions;
}) {
  const {
    parse,
    evaluate,
    cases,
    options: defaultOptions,
  } = options;

  for (const testCase of cases) {
    const match = await parse(testCase.syntax, testCase.options ?? defaultOptions);
    assertEquals(match.kind, MatchKind.Ok, `syntax: ${testCase.syntax}`);
    if (match.kind === MatchKind.Ok) {
      assertEquals(match.value, testCase.expectedAst);
      const value = await evaluate(match.value, match);
      assertEquals(value, testCase.expectedValue);
    }
  }
}
