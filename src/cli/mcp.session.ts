import { resolve as resolvePath, toFileUrl } from "@std/path";
import { compileUffdaSyntaxModule } from "../lang/uffda/execute.ts";
import type { UffdaSyntaxModule } from "../lang/uffda/uffda.lang.ts";
import { exec } from "../runtime/exec.ts";
import type { Expression } from "../runtime/expressions/expression.ts";
import { PatternKind } from "../runtime/patterns/pattern.kind.ts";
import { ResolveTargetKind } from "../runtime/patterns/pattern.ts";
import { resolve as resolvePattern } from "../runtime/patterns/resolve.ts";
import type { ModuleDeclaration } from "../runtime/declarations/module.ts";
import { isRule } from "../runtime/modules/rule.ts";
import type { Module } from "../runtime/modules/mod.ts";
import { Resolver } from "../runtime/resolve.ts";
import { Scope } from "../runtime/scope.ts";
import { InputNormalizationMode } from "../input.ts";
import { getRightmostFailure, MatchKind, ok as matchOk } from "../match.ts";
import { ModuleImportResultKind } from "../runtime/resolvers/resolver.ts";
import { CliLanguage } from "./contract.ts";
import { parseSourceToAst } from "./stream.ts";

/**
 * Default artifact root a session resolves `.uff` imports' compiled
 * artifacts under, matching `uffda_compile`'s and the batch CLI's default
 * (`.uffda/ast`) rather than `Resolver`'s own bootstrap-oriented default of
 * `./bin`, so a plain `uffda compile` followed by `uffda_session_load` just
 * works without callers having to pass a matching `artifactRoot` by hand.
 */
const DEFAULT_SESSION_ARTIFACT_ROOT = ".uffda";

/**
 * A `RuntimeSession` is the live, in-memory runtime backing `uffda mcp`'s
 * session lifecycle tools (see
 * `.agents/specifications/languages/cli/mcp-server.spec.md#session-model` and
 * `.agents/requirements/mcp-server/002-session-lifecycle-and-isolation.requirement.md`):
 * a resolver together with the set of modules it has loaded, isolated from
 * every other session.
 *
 * Composition note: rather than mutating a single long-lived `Resolver`
 * in place (which has no public API for late-registering a declaration after
 * construction), each successful `load()` seeds a *new* `Resolver` with every
 * declaration the session has accumulated so far and re-imports from it. This
 * reuses the exact same `Resolver`/`import()` code path the batch CLI's
 * `run`/`exec` modes already use (see `executeModuleDeclaration` in
 * `../runtime/module.execute.ts`) rather than introducing a parallel
 * resolution mechanism, per this chapter's "Composition intent".
 */

export enum SessionLoadFailureCode {
  ParseFailure = "MCP_SESSION_LOAD_PARSE_FAILURE",
  CompileFailure = "MCP_SESSION_LOAD_COMPILE_FAILURE",
  ResolutionFailure = "MCP_SESSION_LOAD_RESOLUTION_FAILURE",
}

export type SessionLoadFailure = {
  code: SessionLoadFailureCode;
  phase: "parse" | "compile" | "resolve";
  message: string;
};

export type LoadedDeclarationKind = "rule" | "func" | "decorator";

export type LoadedDeclarationSummary = {
  name: string;
  kind: LoadedDeclarationKind;
  /** Whether this declaration is part of its module's public `export` set. */
  exported: boolean;
};

export type LoadedModuleSummary = {
  moduleUrl: string;
  declarations: LoadedDeclarationSummary[];
};

export type SessionLoadResult =
  | { ok: true; module: LoadedModuleSummary }
  | {
    ok: false;
    error: SessionLoadFailure;
    /**
     * Modules this session had already successfully loaded prior to this
     * failing `load()` call. Explicitly labeled partial information per
     * `.agents/requirements/mcp-server/010-error-and-determinism-contract.requirement.md`
     * — never silently dropped alongside a failure.
     */
    partiallyLoadedModules: LoadedModuleSummary[];
    /**
     * Other modules that were themselves successfully resolved by this
     * failing `load()` call before the failure occurred — for example a
     * resolvable import's own exports — even though the load as a whole did
     * not succeed and none of this is committed to the session's graph.
     * Always empty for parse/compile-phase failures, since resolution never
     * started.
     */
    resolvedDuringLoad: LoadedModuleSummary[];
  };

export enum SessionEvalFailureCode {
  InvalidInput = "MCP_SESSION_EVAL_INVALID_INPUT",
  InvalidJson = "MCP_SESSION_EVAL_INVALID_JSON",
  UnknownModule = "MCP_SESSION_EVAL_UNKNOWN_MODULE",
  ParseFailure = "MCP_SESSION_EVAL_PARSE_FAILURE",
  ExpressionException = "MCP_SESSION_EVAL_EXPRESSION_EXCEPTION",
  MatchFailure = "MCP_SESSION_EVAL_MATCH_FAILURE",
}

export type SessionEvalFailure = {
  code: SessionEvalFailureCode;
  phase: "input" | "parse" | "resolve" | "eval";
  message: string;
  inputPosition?: string;
  inputDescription?: string;
};

export type SessionEvalResult =
  | { ok: true; value: unknown }
  | { ok: false; error: SessionEvalFailure };

export type SessionEvalInput = {
  /**
   * Which loaded module's scope to evaluate against (an href/path this
   * session already loaded). Defaults to the most recently loaded module.
   */
  moduleUrl?: string;
  /**
   * An Uffda expression to evaluate (parsed with the expression grammar),
   * for example `(add 1 2)` to invoke an in-scope func, or a member/object
   * construction. Mutually exclusive with `rule`.
   */
  expression?: string;
  /**
   * The name of an exported Rule to invoke against `input` (mutually
   * exclusive with `expression`). Omit the name and rely on the module's
   * default export instead by leaving both unset only if `expression` is
   * also unset — one of `expression`/`rule` is always required.
   */
  rule?: string;
  /** Subject text to match `rule` against. Required when `rule` is set. */
  input?: string;
  /**
   * When true, `input` is parsed as JSON before matching. Defaults to false
   * (input is matched as raw text/iterable), matching `uffda_match`'s
   * convention.
   */
  inputIsJson?: boolean;
};

export type RuntimeSessionOptions = {
  cwd?: string;
  /**
   * Root whose `ast/` subtree mirrors compiled `.uff` artifacts, used to
   * resolve this session's `.uff` imports. Defaults to
   * `DEFAULT_SESSION_ARTIFACT_ROOT` (`.uffda`), matching `uffda_compile`'s
   * default output location.
   */
  artifactRoot?: string;
};

/**
 * Placeholder resolve pattern used only for `ModuleResolutionContext`
 * diagnostics; `load()` doesn't run any rule/func, it only resolves module
 * structure, so no real target name is meaningful here.
 */
function loadContextPattern() {
  return {
    kind: PatternKind.Resolve,
    targetKind: ResolveTargetKind.Run,
    name: undefined,
  } as const;
}

/**
 * Placeholder pattern used only to synthesize a `MatchOk` context for
 * standalone expression evaluation (`uffda_session_eval`'s `expression`
 * mode): `exec()` requires a `MatchOk` to resolve `_`/`this`/variables
 * against, but a bare expression isn't itself the result of matching any
 * real pattern, so there is no meaningful pattern to attribute it to.
 */
function evalContextPattern() {
  return {
    kind: PatternKind.Resolve,
    targetKind: ResolveTargetKind.Run,
    name: undefined,
  } as const;
}

function summarizeModule(moduleUrl: URL, module: Module): LoadedModuleSummary {
  const declarations: LoadedDeclarationSummary[] = [];
  const push = (name: string, kind: LoadedDeclarationKind) => {
    declarations.push({ name, kind, exported: module.exports.has(name) });
  };
  for (const name of module.rules.keys()) push(name, "rule");
  for (const name of module.funcs.keys()) push(name, "func");
  for (const name of module.decorators.keys()) push(name, "decorator");
  // `imports`/`decoratorImports` are the names this module bound from other
  // modules (either for its own local use, or to re-export). Walking them
  // too — in addition to this module's own `rules`/`funcs`/`decorators` —
  // ensures a re-exported import is reported rather than silently skipped.
  for (const [name, member] of module.imports) {
    push(name, isRule(member) ? "rule" : "func");
  }
  for (const name of module.decoratorImports.keys()) push(name, "decorator");
  return { moduleUrl: moduleUrl.href, declarations };
}

/**
 * Summarizes every module `resolver` has resolved so far (per its
 * `resolvedModules` graph) that isn't in `excludeHrefs` — used to surface
 * modules a failing `load()` call nonetheless successfully resolved along
 * the way (see `SessionLoadResult`'s `resolvedDuringLoad`). Since
 * `Resolver.import()` rolls back its own cache entry for any URL whose
 * resolution fails, `resolvedModules` only ever contains genuinely,
 * completely resolved modules — never a half-built entry for one that's
 * still in flight or that itself failed. `excludeHrefs` is used to omit the
 * failing load's own root module (which resolved nothing useful) and any
 * module the session had already committed from a prior `load()` (already
 * reported via `partiallyLoadedModules`, so repeating it here would be
 * redundant).
 */
function collectResolvedModules(
  resolver: Resolver,
  excludeHrefs: ReadonlySet<string>,
): LoadedModuleSummary[] {
  const summaries: LoadedModuleSummary[] = [];
  for (const [href, module] of resolver.resolvedModules) {
    if (excludeHrefs.has(href)) continue;
    summaries.push(summarizeModule(new URL(href), module));
  }
  return summaries;
}

export class RuntimeSession {
  public readonly id: string;
  private readonly cwd: string;
  private readonly artifactRoot: string;
  private readonly declarations = new Map<string, ModuleDeclaration>();
  private readonly modules = new Map<string, Module>();
  private readonly moduleOrder: string[] = [];
  // The href of the most recent successful `load()` call's *root* module
  // (as opposed to `moduleOrder`'s last entry, which is populated in
  // resolver-discovery order and so is the root's *last transitive import*
  // once that root pulls in anything). This is what `eval()` defaults to
  // when `moduleUrl` is omitted.
  private lastLoadedRootHref?: string;
  private nextAnonymousLoadId = 0;
  private closed = false;

  constructor(id: string, options?: RuntimeSessionOptions) {
    this.id = id;
    this.cwd = options?.cwd ?? Deno.cwd();
    this.artifactRoot = options?.artifactRoot ?? DEFAULT_SESSION_ARTIFACT_ROOT;
  }

  public get isClosed(): boolean {
    return this.closed;
  }

  /** Modules this session has successfully loaded so far, in load order. */
  public listLoadedModules(): LoadedModuleSummary[] {
    return this.moduleOrder.map((href) =>
      summarizeModule(new URL(href), this.modules.get(href)!)
    );
  }

  /**
   * Parses, compiles, and resolves `source` against this session's
   * accumulated module graph, adding it (and any modules it imports) on
   * success. `path`, if given, is resolved against this session's `cwd` and
   * used as the module's stable identity (so imports and re-loads of the same
   * file address the same module); otherwise an anonymous, session-scoped
   * identity is synthesized for inline source.
   */
  public async load(
    source: string,
    path?: string,
  ): Promise<SessionLoadResult> {
    if (this.closed) {
      throw new Error(`Session ${this.id} is closed`);
    }

    const moduleUrl = path ? toFileUrl(resolvePath(this.cwd, path)) : new URL(
      `session:///${this.id}/${this.nextAnonymousLoadId++}.uff`,
    );

    const parsed = await parseSourceToAst(
      source,
      CliLanguage.FullUffda,
      path ?? moduleUrl.href,
    );
    if (!parsed.ok) {
      return {
        ok: false,
        error: {
          code: SessionLoadFailureCode.ParseFailure,
          phase: "parse",
          message: parsed.error.message,
        },
        partiallyLoadedModules: this.listLoadedModules(),
        resolvedDuringLoad: [],
      };
    }

    let declaration: ModuleDeclaration;
    try {
      declaration = await compileUffdaSyntaxModule(
        parsed.ast as UffdaSyntaxModule,
      );
    } catch (error) {
      return {
        ok: false,
        error: {
          code: SessionLoadFailureCode.CompileFailure,
          phase: "compile",
          message: error instanceof Error ? error.message : String(error),
        },
        partiallyLoadedModules: this.listLoadedModules(),
        resolvedDuringLoad: [],
      };
    }

    const trialDeclarations = new Map(this.declarations);
    trialDeclarations.set(moduleUrl.href, declaration);
    const resolver = new Resolver({
      declarations: Object.fromEntries(trialDeclarations),
      cwd: this.cwd,
      artifactRoot: this.artifactRoot,
    });
    const scope = Scope.Default().withOptions({ resolver });

    // The failing load's own root href, plus every module this session has
    // already committed from a prior `load()` — both excluded from
    // `resolvedDuringLoad` below: the root resolved nothing useful, and
    // already-committed modules are already reported via
    // `partiallyLoadedModules`, so repeating them would be redundant.
    const excludeFromResolvedDuringLoad = new Set([
      moduleUrl.href,
      ...this.modules.keys(),
    ]);

    // Wrapped in try/catch: some failure modes (for example a relative
    // `.uff` import resolved against an anonymous `session://` module URL,
    // which isn't a file URL) throw rather than returning a resolution
    // error result. Either way this must surface as a structured
    // `ResolutionFailure`, never an unhandled exception.
    let imported: Awaited<ReturnType<Resolver["import"]>>;
    try {
      imported = await resolver.import(moduleUrl, {
        scope,
        pattern: loadContextPattern(),
      });
    } catch (error) {
      return {
        ok: false,
        error: {
          code: SessionLoadFailureCode.ResolutionFailure,
          phase: "resolve",
          message: error instanceof Error ? error.message : String(error),
        },
        partiallyLoadedModules: this.listLoadedModules(),
        resolvedDuringLoad: collectResolvedModules(
          resolver,
          excludeFromResolvedDuringLoad,
        ),
      };
    }
    if (imported.kind === ModuleImportResultKind.Error) {
      return {
        ok: false,
        error: {
          code: SessionLoadFailureCode.ResolutionFailure,
          phase: "resolve",
          message: `${imported.error.code}: ${imported.error.message}`,
        },
        partiallyLoadedModules: this.listLoadedModules(),
        resolvedDuringLoad: collectResolvedModules(
          resolver,
          excludeFromResolvedDuringLoad,
        ),
      };
    }

    // Persist every module the resolver reached (the root plus any
    // transitively imported modules), not just the root, so the session's
    // graph — and `listLoadedModules()` / future `load()` seeds — never
    // silently drop imported modules.
    for (const [href, module] of resolver.resolvedModules) {
      this.modules.set(href, module);
      if (!this.moduleOrder.includes(href)) {
        this.moduleOrder.push(href);
      }
    }
    for (const [href, decl] of resolver.moduleDeclarations) {
      this.declarations.set(href, decl);
    }
    this.lastLoadedRootHref = moduleUrl.href;
    return { ok: true, module: summarizeModule(moduleUrl, imported.module) };
  }

  /**
   * Resolves `moduleUrl` (an href already returned by `load()`, a path
   * already passed to `load()`, or the most recently loaded module's root if
   * omitted) to its cached `Module`.
   */
  private resolveTargetModule(
    moduleUrl?: string,
  ): { ok: true; module: Module } | { ok: false; error: SessionEvalFailure } {
    let href: string | undefined;
    if (moduleUrl) {
      // `moduleUrl` may already be a stored href verbatim (what `load()`
      // returns, including `session://...` for inline loads that have no
      // filesystem path at all) — check that first. Only fall back to
      // resolving it as a path relative to `cwd` for callers passing back
      // the same `path` string they gave `load()`.
      href = this.modules.has(moduleUrl)
        ? moduleUrl
        : toFileUrl(resolvePath(this.cwd, moduleUrl)).href;
    } else {
      href = this.lastLoadedRootHref;
    }
    const module = href ? this.modules.get(href) : undefined;
    if (!module) {
      return {
        ok: false,
        error: {
          code: SessionEvalFailureCode.UnknownModule,
          phase: "resolve",
          message: href
            ? `No module loaded in this session with url: ${href}`
            : "This session has no loaded modules to evaluate against",
        },
      };
    }
    return { ok: true, module };
  }

  /**
   * Evaluates an expression, or invokes a named Rule against subject input,
   * using this session's already-resolved module state (no re-parsing or
   * re-resolving any loaded module) — see
   * `.agents/requirements/mcp-server/006-evaluation-tool.requirement.md`.
   *
   * Func invocation is expressed through `expression` (for example
   * `(myFunc 1 2)`), since Funcs are ordinary callable values resolved
   * through the expression grammar's `Reference`/`Invocation` nodes. `rule`
   * is for invoking a named Rule — which matches against a stream of input
   * rather than a fixed argument list — against `input` text.
   */
  public async eval(input: SessionEvalInput): Promise<SessionEvalResult> {
    if (this.closed) {
      throw new Error(`Session ${this.id} is closed`);
    }

    const hasExpression = input.expression !== undefined;
    const hasRule = input.rule !== undefined;
    if (hasExpression === hasRule) {
      return {
        ok: false,
        error: {
          code: SessionEvalFailureCode.InvalidInput,
          phase: "input",
          message: "Provide exactly one of `expression` or `rule`.",
        },
      };
    }

    const target = this.resolveTargetModule(input.moduleUrl);
    if (!target.ok) return target;
    const { module } = target;

    if (hasExpression) {
      const parsed = await parseSourceToAst(
        input.expression!,
        CliLanguage.Expression,
      );
      if (!parsed.ok) {
        return {
          ok: false,
          error: {
            code: SessionEvalFailureCode.ParseFailure,
            phase: "parse",
            message: parsed.error.message,
          },
        };
      }

      const scope = Scope.Default().pushModule(module);
      const context = matchOk(scope, scope, evalContextPattern(), undefined);
      try {
        const value = await exec(parsed.ast as Expression, context);
        return { ok: true, value };
      } catch (error) {
        return {
          ok: false,
          error: {
            code: SessionEvalFailureCode.ExpressionException,
            phase: "eval",
            message: error instanceof Error ? error.message : String(error),
          },
        };
      }
    }

    if (input.input === undefined) {
      return {
        ok: false,
        error: {
          code: SessionEvalFailureCode.InvalidInput,
          phase: "input",
          message: "`input` is required when `rule` is set.",
        },
      };
    }

    const jsonInput = input.inputIsJson ?? false;
    let subject: unknown = input.input;
    if (jsonInput) {
      try {
        subject = JSON.parse(input.input);
      } catch (error) {
        return {
          ok: false,
          error: {
            code: SessionEvalFailureCode.InvalidJson,
            phase: "input",
            message: error instanceof Error ? error.message : String(error),
          },
        };
      }
    }

    const scope = Scope.From(subject, {
      kind: jsonInput
        ? InputNormalizationMode.Scalar
        : InputNormalizationMode.Iterable,
    }).pushModule(module);
    const result = await resolvePattern(
      {
        kind: PatternKind.Resolve,
        targetKind: ResolveTargetKind.Run,
        name: input.rule,
      },
      scope,
    );

    switch (result.kind) {
      case MatchKind.Ok:
        return { ok: true, value: result.value };
      case MatchKind.Error:
        return {
          ok: false,
          error: {
            code: SessionEvalFailureCode.MatchFailure,
            phase: "eval",
            message: `${result.code}: ${result.message}`,
          },
        };
      case MatchKind.Fail: {
        const rightmost = getRightmostFailure(result);
        return {
          ok: false,
          error: {
            code: SessionEvalFailureCode.MatchFailure,
            phase: "eval",
            message: input.rule
              ? `Rule '${input.rule}' did not match input at ${rightmost.span.start.toString()}`
              : `Default rule did not match input at ${rightmost.span.start.toString()}`,
            inputPosition: rightmost.span.start.toString(),
            inputDescription: await rightmost.scope.stream.done()
              ? "end of input"
              : "a value that did not match",
          },
        };
      }
      case MatchKind.LR:
        return {
          ok: false,
          error: {
            code: SessionEvalFailureCode.MatchFailure,
            phase: "eval",
            message: "match failed with left recursion outcome",
          },
        };
    }
  }

  /** Releases this session's in-memory state. Idempotent. */
  public close(): void {
    this.declarations.clear();
    this.modules.clear();
    this.moduleOrder.length = 0;
    this.lastLoadedRootHref = undefined;
    this.closed = true;
  }
}
