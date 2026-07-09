import { assertEquals } from "@std/assert";
import { type Match, MatchKind, type MatchOk } from "../match.ts";
import { PatternKind } from "../runtime/patterns/pattern.kind.ts";
import { ResolveTargetKind } from "../runtime/patterns/pattern.ts";
import { Scope } from "../runtime/scope.ts";
import { std } from "../runtime/std/mod.ts";
import { resolve } from "../runtime/patterns/resolve.ts";
import { ModuleImportResultKind } from "../runtime/resolvers/resolver.ts";
import { Resolver } from "../mod.ts";
import type { ModuleDeclaration } from "../runtime/declarations/module.ts";

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

export type GrammarOptions = {
  globals?: Map<string, unknown>;
  declarations?: Record<string, ModuleDeclaration>;
};

export async function parseGrammar<TAst>(options: {
  source: string;
  moduleUrl: URL;
  entryRuleName: string;
  grammarOptions?: GrammarOptions;
}): Promise<Match<TAst>> {
  const {
    source,
    moduleUrl,
    entryRuleName,
    grammarOptions,
  } = options;
  const { globals, declarations } = grammarOptions ?? {};

  const g = globals ?? std;
  const r = new Resolver({ declarations });
  const s = Scope
    .From(source)
    .withOptions({ globals: g, resolver: r });

  const m = await r.import(moduleUrl, {
    scope: s,
    pattern: {
      kind: PatternKind.Resolve,
      targetKind: ResolveTargetKind.Run,
      name: entryRuleName,
    },
  });
  if (m.kind === ModuleImportResultKind.Error) {
    return m.error;
  }

  const scoped = s.pushModule(m.module);
  const parsed = await resolve(
    {
      kind: PatternKind.Resolve,
      targetKind: ResolveTargetKind.Run,
      name: entryRuleName,
    },
    scoped,
  );

  if (parsed.kind === MatchKind.Ok) {
    return {
      ...parsed,
      value: parsed.value as TAst,
    };
  }

  return parsed;
}

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
    const match = await parse(
      testCase.syntax,
      testCase.options ?? defaultOptions,
    );
    assertEquals(match.kind, MatchKind.Ok, `syntax: ${testCase.syntax}`);
    if (match.kind === MatchKind.Ok) {
      assertEquals(match.value, testCase.expectedAst);
      const value = await evaluate(match.value, match);
      assertEquals(value, testCase.expectedValue);
    }
  }
}
