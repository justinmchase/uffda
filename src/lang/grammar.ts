import type { Awaitable } from "../runtime/awaitable.ts";
import { assertEquals } from "@std/assert";
import {
  isSuccess,
  type Match,
  MatchKind,
  type MatchSuccess,
} from "../match.ts";
import { PatternKind } from "../runtime/patterns/pattern.kind.ts";
import {
  type Pattern,
  ResolveTargetKind,
} from "../runtime/patterns/pattern.ts";
import { match } from "../runtime/match.ts";
import { Scope } from "../runtime/scope.ts";
import { globals as defaultGlobals } from "../runtime/runtime.ts";
import { matchWithRecovery } from "../runtime/recovery.ts";
import { languageArtifactRoots } from "../runtime/resolvers/language_artifact_roots.ts";
import { ModuleImportResultKind } from "../runtime/resolvers/resolver.ts";
import { Resolver } from "../runtime/resolve.ts";
import type { ModuleDeclaration } from "../runtime/declarations/module.ts";
import type { Module } from "../runtime/modules/module.ts";
import type { Input } from "../input.ts";
import type { Memos } from "../memo.ts";
import { valueOf } from "../match.ts";
import { unwrap } from "../wrapped.ts";

export type GrammarParse<TAst, TOptions> = (
  source: string,
  options?: TOptions,
) => Promise<Match<TAst>>;

export type GrammarEvaluate<TAst, TResult> = (
  ast: TAst,
  match: MatchSuccess<TAst>,
) => Awaitable<TResult>;

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
    match: MatchSuccess<TAst>;
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
  /**
   * Requests two-phase matching (see
   * `.agents/specifications/runtime/error-recovery.spec.md#two-phase-matching`):
   * a parse that fails may then succeed as a recovered match, which callers
   * must not consume as clean. Off by default.
   */
  recovery?: boolean;
};

export type ResolvedGrammarModule = {
  module: Module;
  scope: Scope;
};

export type ResolveGrammarModuleResult<TAst> =
  | { ok: true; resolved: ResolvedGrammarModule }
  | { ok: false; error: Match<TAst> };

/**
 * Resolves (imports) `moduleUrl` without running any rule/func against it —
 * the shared first half of `parseGrammar`, factored out so callers that
 * only need the compiled `Module` itself (for example to read decorator
 * metadata off an entry rule, see `src/cli/language_metadata.ts`) don't need
 * to also perform a full parse of some source text just to reach it.
 */
export async function resolveGrammarModule<TAst>(options: {
  moduleUrl: URL;
  entryRuleName: string;
  source?: string;
  grammarOptions?: GrammarOptions;
}): Promise<ResolveGrammarModuleResult<TAst>> {
  const { moduleUrl, entryRuleName, source, grammarOptions } = options;
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
  let s = (input ? Scope.Default().withInput(input) : Scope.From(source ?? ""))
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
    return { ok: false, error: m.error as Match<TAst> };
  }

  return { ok: true, resolved: { module: m.module, scope: s } };
}

export async function parseGrammar<TAst>(options: {
  source: string;
  moduleUrl: URL;
  entryRuleName: string;
  grammarOptions?: GrammarOptions;
}): Promise<Match<TAst>> {
  const { source, moduleUrl, entryRuleName, grammarOptions } = options;

  const resolved = await resolveGrammarModule<TAst>({
    moduleUrl,
    entryRuleName,
    source,
    grammarOptions,
  });
  if (!resolved.ok) return resolved.error;

  const { module, scope } = resolved.resolved;
  const scoped = scope.pushModule(module);
  const entry: Pattern = {
    kind: PatternKind.Resolve,
    targetKind: ResolveTargetKind.Run,
    name: entryRuleName,
  };
  const parsed =
    await (grammarOptions?.recovery
      ? matchWithRecovery(entry, scoped)
      : match(entry, scoped));

  return parsed as Match<TAst>;
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
    if (!isSuccess(match)) {
      return {
        kind: "match",
        match,
      };
    }
    return {
      kind: "result",
      match,
      result: unwrap(await evaluate(valueOf(match), match)) as TResult,
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
    if (isSuccess(match)) {
      assertEquals(valueOf(match), testCase.expectedAst);
      const value = await evaluate(valueOf(match), match);
      assertEquals(unwrap(value), testCase.expectedValue);
    }
  }
}
