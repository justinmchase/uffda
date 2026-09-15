import { assertEquals } from "@std/assert";
import { type Match, MatchKind, type MatchOk } from "../match.ts";
import { PatternKind } from "../runtime/patterns/pattern.kind.ts";
import { ResolveTargetKind } from "../runtime/patterns/pattern.ts";
import { Scope } from "../runtime/scope.ts";
import { globals as defaultGlobals } from "../runtime/runtime.ts";
import { resolve } from "../runtime/patterns/resolve.ts";
import { languageArtifactRoots } from "../runtime/resolvers/language_artifact_roots.ts";
import { ModuleImportResultKind } from "../runtime/resolvers/resolver.ts";
import { Resolver } from "../runtime/resolve.ts";
import type { ModuleDeclaration } from "../runtime/declarations/module.ts";
import type { Input } from "../input.ts";
import type { Memos } from "../memo.ts";

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
  /**
   * Pre-seeded memo table to parse against instead of a fresh, empty one —
   * typically rehydrated from a prior parse's delivered `Match` tree via
   * `rehydrateMemos` (see
   * `.agents/specifications/runtime/incremental-parsing.spec.md`). Only
   * meaningful together with `input` (below): both must come from the same
   * incremental re-parse setup for the memo table's captured positions to
   * line up with the stream this parse actually walks.
   */
  memos?: Memos;
  /**
   * Pre-built `Input` stream to parse over, instead of building a fresh one
   * from `source` text. Required for incremental re-parsing so the parse
   * walks the exact same `Input` chain `rehydrateMemos` indexed positions
   * against, rather than an equivalent-but-distinct chain built again from
   * scratch.
   */
  input?: Input;
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
  const { globals, declarations, memos, input } = grammarOptions ?? {};
  const { builtInLanguageDeclarations } = await import("./declarations.ts");

  // Caller globals override default entries with the same name; defaults
  // remain available for serializable projections such as `(join (flat _) "")`.
  const g = new Map([...defaultGlobals, ...(globals ?? [])]);
  const { cwd, artifactRoot } = languageArtifactRoots(import.meta.url);
  const r = new Resolver({
    declarations: {
      ...builtInLanguageDeclarations,
      ...declarations,
    },
    cwd,
    artifactRoot,
  });
  let s = (input ? Scope.Default().withInput(input) : Scope.From(source))
    .withOptions({ globals: g, resolver: r });
  if (memos) {
    s = s.withMemos(memos);
  }

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
