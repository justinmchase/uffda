import { fromFileUrl, resolve as resolvePath, toFileUrl } from "@std/path";
import { compileUffdaSyntaxModule } from "../lang/uffda/execute.ts";
import type { UffdaSyntaxModule } from "../lang/uffda/uffda.lang.ts";
import { exec } from "../runtime/exec.ts";
import type { Expression } from "../runtime/expressions/expression.ts";
import { match } from "../runtime/match.ts";
import type { Pattern } from "../runtime/patterns/pattern.ts";
import { PatternKind } from "../runtime/patterns/pattern.kind.ts";
import { ResolveTargetKind } from "../runtime/patterns/pattern.ts";
import { resolve as resolvePattern } from "../runtime/patterns/resolve.ts";
import type { ModuleDeclaration } from "../runtime/declarations/module.ts";
import type { DecoratorFunc } from "../runtime/modules/decorator.ts";
import type { Func } from "../runtime/modules/func.ts";
import {
  isRule,
  type Rule,
  type RuleParameter,
} from "../runtime/modules/rule.ts";
import type { Module } from "../runtime/modules/mod.ts";
import { Resolver } from "../runtime/resolve.ts";
import { Scope } from "../runtime/scope.ts";
import { Input, InputNormalizationMode } from "../input.ts";
import { Path } from "../path.ts";
import type { Edit } from "../edit.ts";
import { rehydrateMemos } from "../runtime/incremental.ts";
import {
  getRightmostFailure,
  type Match,
  MatchKind,
  ok as matchOk,
  type SourceSpan,
} from "../match.ts";
import {
  type ImportFrame,
  ModuleImportResultKind,
} from "../runtime/resolvers/resolver.ts";
import { CliLanguage } from "./contract.ts";
import {
  ensureCompiledImportArtifacts,
  type EnsureImportDependencyFailure,
} from "./ensure_import_artifacts.ts";
import { importFrameLocation } from "./import_location.ts";
import { anchorParseFailureLocation } from "./parse_failure_anchor.ts";
import { parseSourceToAst } from "./stream.ts";
import type { CliStreamFailureLocation } from "./stream.ts";

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
  /**
   * The offset/line/column of the failure within the module's source text,
   * when known: the failing token for `phase: "parse"`, or the module
   * specifier of the root import a `phase: "resolve"` failure is attributed
   * to (see `importChain`). Absent otherwise; consumers fall back to
   * whole-document attribution (see
   * `.agents/requirements/cli-language-server/004-diagnostics.requirement.md`).
   */
  location?: CliStreamFailureLocation;
  /**
   * For a resolve failure caused by an import, the import edges from this
   * module (first frame) down to the module that failed (last frame).
   */
  importChain?: ImportFrame[];
  /** The transitive dependency whose own source failed to compile. */
  dependencyFailure?: EnsureImportDependencyFailure;
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

export enum SessionPatchFailureCode {
  UnknownModule = "MCP_SESSION_PATCH_UNKNOWN_MODULE",
  InvalidEdit = "MCP_SESSION_PATCH_INVALID_EDIT",
}

export type SessionPatchFailure =
  | SessionLoadFailure
  | {
    code: SessionPatchFailureCode;
    phase: "input";
    message: string;
  };

export type SessionPatchInput = {
  /**
   * The module to patch: an href already returned by `load()`, or the
   * `path` string already passed to `load()`. Defaults to the most
   * recently loaded root module, matching `resolveTargetModule`'s default.
   */
  moduleUrl?: string;
  /** Character offset (inclusive) where the replaced span begins. */
  start: number;
  /** Character offset (exclusive) where the replaced span ends. */
  end: number;
  /** Text to splice into `[start, end)`. */
  replacement: string;
};

export type SessionPatchResult =
  | { ok: true; module: LoadedModuleSummary }
  | {
    ok: false;
    error: SessionPatchFailure;
    partiallyLoadedModules: LoadedModuleSummary[];
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
  /**
   * Present when a rule invocation produced a match result tree (Ok or
   * Fail) even though evaluation as a whole failed — the tree is retained
   * in the session under this id and can still be traversed via `walk()`
   * for diagnostics, exactly like a successful invocation's tree.
   */
  matchResultId?: string;
};

export type SessionEvalResult =
  | { ok: true; value: unknown; matchResultId?: string }
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

/**
 * Match-tree walking tool (see
 * `.agents/requirements/mcp-server/008-match-tree-walking-tool.requirement.md`):
 * deterministic, windowed/paginated traversal of a match result tree
 * `eval()` retained under a `matchResultId`. Read-only — it only ever reads
 * a retained `Match` tree, never mutates it or session state.
 */

export enum SessionWalkFailureCode {
  UnknownMatchResult = "MCP_SESSION_WALK_UNKNOWN_MATCH_RESULT",
  InvalidPath = "MCP_SESSION_WALK_INVALID_PATH",
}

export type SessionWalkFailure = {
  code: SessionWalkFailureCode;
  phase: "input";
  message: string;
};

/**
 * One rule invocation's contribution to a walked node's resolved metadata
 * (see
 * `.agents/specifications/runtime/rule-metadata.spec.md#metadata-resolution`).
 * A node's full `metadata` list is built by walking from the match tree's
 * root down to that node (inclusive) and collecting one entry per visited
 * node that originated a fresh rule invocation, in that root-to-node order —
 * never merged into one object, since more than one ancestor may apply the
 * same decorator name to a different span.
 */
export type SessionWalkMetadataContribution = {
  rule: string;
  metadata: Record<string, unknown>;
};

export type SessionWalkNode = {
  /** Child indices from the walked tree's root down to this node. */
  path: number[];
  kind: "ok" | "fail" | "error" | "lr";
  pattern: Pattern;
  normalizedSpan?: SourceSpan;
  originalSpan?: SourceSpan;
  /** Only present for `kind: "ok"`. */
  value?: unknown;
  /** Only present for `kind: "error"`. */
  code?: string;
  /** Only present for `kind: "error"`. */
  message?: string;
  /** Number of direct child matches reachable below this node (0 for
   * `error`/`lr`, which never have any). */
  childCount: number;
  /** Set only when this node is the Ok/Fail produced by a fresh rule
   * invocation (see `MatchOrigin` in `../match.ts`). */
  rule?: string;
  /** Variables bound in this node's scope, flattened to a plain object. */
  variables: Record<string, unknown>;
  metadata: SessionWalkMetadataContribution[];
};

export type SessionWalkInput = {
  /** A `matchResultId` returned by a prior `eval()` rule invocation. */
  matchResultId: string;
  /** Child indices from the retained tree's root to the node to start
   * walking from. Defaults to `[]` (the tree's root). */
  path?: number[];
  /** Maximum number of nodes to return in this window (pre-order
   * depth-first from the start node, inclusive). Defaults to 50. */
  maxNodes?: number;
  /** Maximum depth (relative to the start node; 0 = only the start node
   * itself) to descend into. Omit for no depth limit (bounded only by
   * `maxNodes`). */
  maxDepth?: number;
};

export type SessionWalkResult =
  | { ok: true; nodes: SessionWalkNode[]; truncated: boolean }
  | { ok: false; error: SessionWalkFailure };

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
 * Introspection tools (see
 * `.agents/requirements/mcp-server/007-introspection-and-query-tools.requirement.md`):
 * "list modules", "describe declaration", and "query by decorator metadata".
 * All three are read-only — they only ever read `this.modules`, never
 * mutate session state — and reuse the session's already-resolved `Module`
 * objects exactly as `eval()` does, rather than re-deriving anything.
 */

export enum SessionDescribeFailureCode {
  UnknownModule = "MCP_SESSION_DESCRIBE_UNKNOWN_MODULE",
  UnknownDeclaration = "MCP_SESSION_DESCRIBE_UNKNOWN_DECLARATION",
}

export type SessionDescribeFailure = {
  code: SessionDescribeFailureCode;
  phase: "resolve";
  message: string;
};

/** An applied attribute, summarized for JSON transport (decorator by name). */
export type DescribedAttribute = {
  decorator: string;
  args: unknown[];
};

export type DescribedDeclaration = {
  moduleUrl: string;
  name: string;
  kind: LoadedDeclarationKind;
  exported: boolean;
  pattern: Pattern;
  /** Absent for a `Rule` with no projection (`->`). Always present for
   * `func`/`decorator`, which always have a body expression. */
  expression?: Expression;
  /** Only present for `kind: "rule"`. */
  parameters?: RuleParameter[];
  /** Only present for `kind: "rule" | "func"` — decorators aren't
   * decoratable, see `.agents/specifications/runtime/rule-metadata.spec.md`. */
  attributes?: DescribedAttribute[];
  /** Only present for `kind: "rule" | "func"`, keyed by decorator name. */
  metadata?: Record<string, unknown>;
};

export type SessionDescribeResult =
  | { ok: true; declaration: DescribedDeclaration }
  | { ok: false; error: SessionDescribeFailure };

/**
 * A name resolved against a loaded module's declaration surface for
 * go-to-definition. `definingModuleUrl` is always the module that owns the
 * `Rule`/`Func`/`DecoratorFunc` object (`member.module.moduleUrl`), which
 * for an import is the imported defining module — not the lookup module.
 */
export type ResolvedDeclaration = {
  name: string;
  kind: LoadedDeclarationKind;
  definingModuleUrl: string;
  /** The module `name` was looked up in (local or as an import binding). */
  lookupModuleUrl: string;
  exported: boolean;
};

export type SessionResolveDeclarationResult =
  | { ok: true; declaration: ResolvedDeclaration }
  | { ok: false; error: SessionDescribeFailure };

export enum SessionQueryFailureCode {
  ParseFailure = "MCP_SESSION_QUERY_PARSE_FAILURE",
}

export type SessionQueryFailure = {
  code: SessionQueryFailureCode;
  phase: "parse";
  message: string;
};

export type SessionQueryMatch = {
  moduleUrl: string;
  name: string;
  kind: "rule" | "func";
  /** This declaration's `metadata[decorator]` value (the matched entry). */
  metadata: unknown;
};

export type SessionQueryResult =
  | { ok: true; matches: SessionQueryMatch[] }
  | { ok: false; error: SessionQueryFailure };

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
 * Finds a declaration named `name` in `module` — its own `rules`/`funcs`/
 * `decorators`, or a name it bound via `imports`/`decoratorImports` (so a
 * re-exported import can be described too, matching `summarizeModule`'s
 * lookup surface) — and tags it with its `LoadedDeclarationKind`. Returns
 * `undefined` if no such name exists in this module at all.
 */
function findDeclaration(
  module: Module,
  name: string,
):
  | { member: Rule | Func | DecoratorFunc; kind: LoadedDeclarationKind }
  | undefined {
  const rule = module.rules.get(name);
  if (rule) return { member: rule, kind: "rule" };
  const func = module.funcs.get(name);
  if (func) return { member: func, kind: "func" };
  const decorator = module.decorators.get(name);
  if (decorator) return { member: decorator, kind: "decorator" };
  const imported = module.imports.get(name);
  if (imported) {
    return { member: imported, kind: isRule(imported) ? "rule" : "func" };
  }
  const importedDecorator = module.decoratorImports.get(name);
  if (importedDecorator) {
    return { member: importedDecorator, kind: "decorator" };
  }
  return undefined;
}

/**
 * Builds a `DescribedDeclaration` for `member`/`kind` found in `module` —
 * only `rule`/`func` carry `parameters`/`attributes`/`metadata`, since
 * decorators aren't decoratable and have no separate `parameters` field
 * (see `.agents/specifications/runtime/rule-metadata.spec.md`).
 */
function describeMember(
  moduleUrl: URL,
  name: string,
  member: Rule | Func | DecoratorFunc,
  kind: LoadedDeclarationKind,
  exported: boolean,
): DescribedDeclaration {
  const base: DescribedDeclaration = {
    moduleUrl: moduleUrl.href,
    name,
    kind,
    exported,
    pattern: member.pattern,
    expression: member.expression,
  };
  if (kind === "decorator") return base;

  const ruleOrFunc = member as Rule | Func;
  return {
    ...base,
    parameters: kind === "rule" ? (member as Rule).parameters : undefined,
    attributes: ruleOrFunc.attributes?.map((attribute) => ({
      decorator: attribute.decorator.name,
      args: attribute.args,
    })),
    metadata: ruleOrFunc.metadata,
  };
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
  // Match result trees retained by `eval()` for `walk()` to traverse later
  // (see `.agents/requirements/mcp-server/008-match-tree-walking-tool.requirement.md`).
  // Only rule invocations populate this — expressions and funcs never
  // produce a `Match` tree.
  private readonly matchResults = new Map<string, Match>();
  private nextMatchResultId = 1;
  private closed = false;
  // The exact source text and raw parse `Match` for every module this
  // session has attempted to parse — successful *or* failed — keyed by
  // module href. Retained so (1) a later `patch()` can rehydrate memos from
  // the prior parse and (2) editor features that walk the parse tree (LSP
  // semantic tokens) can classify spans even when the latest parse failed,
  // rather than blanking out highlighting for the whole document (see
  // `.agents/requirements/cli-language-server/005-syntax-highlighting.requirement.md`).
  // Updated whenever a parse produces a `Match`, including after a
  // compile/resolve failure of an otherwise successful parse.
  private readonly parseStates = new Map<
    string,
    { source: string; match: Match }
  >();
  // Href of the most recently retained parse state (see `parseStates`).
  // Distinct from `lastLoadedRootHref`, which only tracks successfully
  // *committed* roots — a failed first open still has a parse tree worth
  // highlighting against.
  private lastParseHref?: string;

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
   * The declarations in scope for one loaded module — its own rules, funcs,
   * and decorators plus names bound by its imports — or `undefined` when no
   * such module has been successfully loaded. Defaults to the most recently
   * loaded root module. Read-only; used by LSP completion (requirement 006).
   */
  public listDeclarations(moduleUrl?: string): LoadedModuleSummary | undefined {
    if (this.closed) {
      throw new Error(`Session ${this.id} is closed`);
    }
    const target = this.resolveTargetModule(moduleUrl);
    if (!target.ok) return undefined;
    return summarizeModule(target.module.moduleUrl, target.module);
  }

  /**
   * Returns the most recently retained parse state (source text + raw
   * `Match` tree), including states retained after a failed parse. Used by
   * the language server to derive semantic tokens from the same tree the
   * session already produced, rather than re-parsing (see
   * `.agents/requirements/cli-language-server/005-syntax-highlighting.requirement.md`).
   */
  public getLatestParseState():
    | { href: string; source: string; match: Match }
    | undefined {
    if (!this.lastParseHref) return undefined;
    const state = this.parseStates.get(this.lastParseHref);
    if (!state) return undefined;
    return {
      href: this.lastParseHref,
      source: state.source,
      match: state.match,
    };
  }

  /**
   * Returns a retained parse state for a specific module href, if this
   * session has ever parsed that module (root loads/patches). Imported
   * modules loaded from artifacts alone do not appear here.
   */
  public getParseState(
    href: string,
  ): { source: string; match: Match } | undefined {
    return this.parseStates.get(href);
  }

  private retainParseState(href: string, source: string, match: Match): void {
    this.parseStates.set(href, { source, match });
    this.lastParseHref = href;
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
    // Retain the parse tree whether or not the parse (or later
    // compile/resolve) succeeds — highlighting and a subsequent incremental
    // `patch()` both need the latest Match aligned with `source`.
    this.retainParseState(moduleUrl.href, source, parsed.match);
    if (!parsed.ok) {
      return {
        ok: false,
        error: {
          code: SessionLoadFailureCode.ParseFailure,
          phase: "parse",
          message: parsed.error.message,
          location: parsed.error.location &&
            anchorParseFailureLocation(
              parsed.match,
              source,
              parsed.error.location,
            ),
        },
        partiallyLoadedModules: this.listLoadedModules(),
        resolvedDuringLoad: [],
      };
    }

    return await this.compileAndCommitModule(
      moduleUrl,
      parsed.ast as UffdaSyntaxModule,
    );
  }

  /**
   * Applies a character-offset-range edit to the current source text of an
   * already file-backed or inline-loaded module, and re-parses/re-resolves
   * only what has to change — reusing memoized parse state for every span
   * that ends strictly before the edit via `rehydrateMemos` (see
   * `.agents/specifications/runtime/incremental-parsing.spec.md`) — rather
   * than requiring the caller to resubmit the module's entire source text
   * through `load()`. Resolution/commit after the parse is identical to a
   * full `load()`, so the result of a successful `patch()` is guaranteed
   * equivalent to reloading the post-edit source in full (see
   * `.agents/requirements/mcp-server/005-incremental-reparse-tool.requirement.md`).
   */
  public async patch(input: SessionPatchInput): Promise<SessionPatchResult> {
    if (this.closed) {
      throw new Error(`Session ${this.id} is closed`);
    }

    const { moduleUrl, start, end, replacement } = input;
    const href = this.hrefFor(moduleUrl);
    const priorState = href ? this.parseStates.get(href) : undefined;
    if (!href || !priorState) {
      return {
        ok: false,
        error: {
          code: SessionPatchFailureCode.UnknownModule,
          phase: "input",
          message: href
            ? `No prior parse state retained for module: ${href}`
            : "This session has no loaded modules to patch",
        },
        partiallyLoadedModules: this.listLoadedModules(),
        resolvedDuringLoad: [],
      };
    }

    const { source, match: priorMatch } = priorState;
    if (
      !Number.isInteger(start) || !Number.isInteger(end) ||
      start < 0 || end < start || end > source.length
    ) {
      return {
        ok: false,
        error: {
          code: SessionPatchFailureCode.InvalidEdit,
          phase: "input",
          message:
            `Invalid edit range [${start}, ${end}) for module source of length ${source.length}`,
        },
        partiallyLoadedModules: this.listLoadedModules(),
        resolvedDuringLoad: [],
      };
    }

    const newSource = source.slice(0, start) + replacement +
      source.slice(end);
    const freshInput = Input.From(newSource, {
      kind: InputNormalizationMode.Scalar,
    });
    const edit: Edit = {
      at: Path.Default().set(start),
      removed: end - start,
      inserted: replacement.length,
    };
    const memos = await rehydrateMemos(priorMatch, edit, freshInput);

    const parsed = await parseSourceToAst(
      newSource,
      CliLanguage.FullUffda,
      href,
      { memos, input: freshInput },
    );
    this.retainParseState(href, newSource, parsed.match);
    if (!parsed.ok) {
      return {
        ok: false,
        error: {
          code: SessionLoadFailureCode.ParseFailure,
          phase: "parse",
          message: parsed.error.message,
          location: parsed.error.location &&
            anchorParseFailureLocation(
              parsed.match,
              newSource,
              parsed.error.location,
            ),
        },
        partiallyLoadedModules: this.listLoadedModules(),
        resolvedDuringLoad: [],
      };
    }

    return await this.compileAndCommitModule(
      new URL(href),
      parsed.ast as UffdaSyntaxModule,
    );
  }

  /**
   * Compiles an already-parsed `UffdaSyntaxModule` AST to a
   * `ModuleDeclaration`, resolves it (and anything it imports) against a
   * trial resolver seeded with this session's accumulated declarations, and
   * commits every module the resolver reached on success. Shared by `load()`
   * (full parse) and `patch()` (incremental re-parse) so both paths commit
   * session state identically.
   */
  private async compileAndCommitModule(
    moduleUrl: URL,
    ast: UffdaSyntaxModule,
  ): Promise<SessionLoadResult> {
    let declaration: ModuleDeclaration;
    try {
      declaration = await compileUffdaSyntaxModule(ast);
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

    // Resolve only loads JSON under the session artifact root; compile any
    // missing/stale file:// `.uff` imports into that root first (default
    // `.uffda`), rather than assuming `./bin` or an LSP-config override.
    const ensured = await ensureCompiledImportArtifacts({
      cwd: this.cwd,
      artifactRoot: this.artifactRoot,
      moduleUrl,
      declaration,
      knownDeclarations: trialDeclarations,
    });
    if (!ensured.ok) {
      const { importChain, dependency } = ensured;
      const direct = importChain.length === 1;
      const reason = direct
        ? `Failed to compile "${importChain[0].moduleUrl}": ${ensured.message}`
        : `failed to compile ${dependency.moduleUrl}: ${ensured.message}`;
      return {
        ok: false,
        error: this.importFailure(moduleUrl, importChain, reason, dependency),
        partiallyLoadedModules: this.listLoadedModules(),
        resolvedDuringLoad: [],
      };
    }

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
      const importChain = imported.importChain ?? [];
      const failed = importChain.at(-1);
      let reason = `${imported.error.code}: ${imported.error.message}`;
      if (failed && ensured.missingSources.has(failed.resolvedUrl)) {
        const missingPath = fromFileUrl(failed.resolvedUrl);
        reason = importChain.length === 1
          ? `Cannot find module "${failed.moduleUrl}": no such file ${missingPath}`
          : `${failed.importerUrl} cannot find module "${failed.moduleUrl}": no such file ${missingPath}`;
      }
      return {
        ok: false,
        error: this.importFailure(moduleUrl, importChain, reason),
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
   * Builds a resolve-phase failure attributed to the root import at the head
   * of `importChain`: `location` is that import's module specifier in the
   * root module's retained parse tree. Transitive failures are prefixed with
   * the root import so the message stands alone at that location.
   */
  private importFailure(
    moduleUrl: URL,
    importChain: ImportFrame[],
    reason: string,
    dependencyFailure?: EnsureImportDependencyFailure,
  ): SessionLoadFailure {
    const root = importChain[0];
    const state = this.parseStates.get(moduleUrl.href);
    const location = root && state
      ? importFrameLocation(state.match, state.source, root)
      : undefined;
    const message = root && importChain.length > 1
      ? `Import "${root.moduleUrl}" failed: ${reason}`
      : reason;
    return {
      code: SessionLoadFailureCode.ResolutionFailure,
      phase: "resolve",
      message,
      ...(location ? { location } : {}),
      ...(importChain.length > 0 ? { importChain } : {}),
      ...(dependencyFailure ? { dependencyFailure } : {}),
    };
  }

  /**
   * Resolves `moduleUrl` (an href already returned by `load()`, a path
   * already passed to `load()`, or the most recently loaded module's root if
   * omitted) to a stored module href, if any. Shared by
   * `resolveTargetModule()` (eval/walk/describe target resolution) and
   * `patch()` (incremental re-parse target resolution).
   */
  private hrefFor(moduleUrl?: string): string | undefined {
    if (moduleUrl) {
      // `moduleUrl` may already be a stored href verbatim (what `load()`
      // returns, including `session://...` for inline loads that have no
      // filesystem path at all) — check that first. Only fall back to
      // resolving it as a path relative to `cwd` for callers passing back
      // the same `path` string they gave `load()`.
      return this.modules.has(moduleUrl)
        ? moduleUrl
        : toFileUrl(resolvePath(this.cwd, moduleUrl)).href;
    }
    return this.lastLoadedRootHref;
  }

  /**
   * Resolves `moduleUrl` (an href already returned by `load()`, a path
   * already passed to `load()`, or the most recently loaded module's root if
   * omitted) to its cached `Module`.
   */
  private resolveTargetModule(
    moduleUrl?: string,
  ): { ok: true; module: Module } | { ok: false; error: SessionEvalFailure } {
    const href = this.hrefFor(moduleUrl);
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
        return {
          ok: true,
          value: result.value,
          matchResultId: this.retainMatchResult(result),
        };
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
            matchResultId: this.retainMatchResult(result),
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

  /**
   * Describes a rule/func/decorator declaration — its pattern/expression
   * structure, parameters, and (for rules/funcs) applied attributes and
   * keyed metadata — using this session's already-resolved state (read-only;
   * never mutates session state). See
   * `.agents/requirements/mcp-server/007-introspection-and-query-tools.requirement.md`.
   */
  public describe(
    name: string,
    moduleUrl?: string,
  ): SessionDescribeResult {
    if (this.closed) {
      throw new Error(`Session ${this.id} is closed`);
    }

    const target = this.resolveTargetModule(moduleUrl);
    if (!target.ok) {
      return {
        ok: false,
        error: {
          code: SessionDescribeFailureCode.UnknownModule,
          phase: "resolve",
          message: target.error.message,
        },
      };
    }
    const { module } = target;

    const found = findDeclaration(module, name);
    if (!found) {
      return {
        ok: false,
        error: {
          code: SessionDescribeFailureCode.UnknownDeclaration,
          phase: "resolve",
          message:
            `No rule/func/decorator named '${name}' in module ${module.moduleUrl.href}`,
        },
      };
    }

    return {
      ok: true,
      declaration: describeMember(
        module.moduleUrl,
        name,
        found.member,
        found.kind,
        module.exports.has(name),
      ),
    };
  }

  /**
   * Resolves a rule/func/decorator name against a loaded module's local and
   * imported declarations, returning the **defining** module URL
   * (`member.module.moduleUrl`) rather than the lookup module. Used by LSP
   * go-to-definition (requirement 006); read-only.
   */
  public resolveDeclaration(
    name: string,
    moduleUrl?: string,
  ): SessionResolveDeclarationResult {
    if (this.closed) {
      throw new Error(`Session ${this.id} is closed`);
    }

    const target = this.resolveTargetModule(moduleUrl);
    if (!target.ok) {
      return {
        ok: false,
        error: {
          code: SessionDescribeFailureCode.UnknownModule,
          phase: "resolve",
          message: target.error.message,
        },
      };
    }
    const { module } = target;

    const found = findDeclaration(module, name);
    if (!found) {
      return {
        ok: false,
        error: {
          code: SessionDescribeFailureCode.UnknownDeclaration,
          phase: "resolve",
          message:
            `No rule/func/decorator named '${name}' in module ${module.moduleUrl.href}`,
        },
      };
    }

    return {
      ok: true,
      declaration: {
        name,
        kind: found.kind,
        definingModuleUrl: found.member.module.moduleUrl.href,
        lookupModuleUrl: module.moduleUrl.href,
        exported: found.member.module.exports.has(name),
      },
    };
  }

  /**
   * Finds every rule/func across this session's loaded modules whose
   * metadata has an own-key entry for `decorator` (the name-keyed store
   * produced by decorator application — not inherited Object.prototype
   * properties), optionally filtered by `predicate` — an Uffda pattern
   * (parsed with the pattern grammar) matched against that entry's value,
   * reusing the same pattern-matching machinery `uffda_match` uses rather
   * than a parallel predicate mechanism. Read-only; never mutates session
   * state. See
   * `.agents/requirements/mcp-server/007-introspection-and-query-tools.requirement.md`.
   */
  public async queryByMetadata(
    decorator: string,
    predicate?: string,
  ): Promise<SessionQueryResult> {
    if (this.closed) {
      throw new Error(`Session ${this.id} is closed`);
    }

    let pattern: Pattern | undefined;
    if (predicate !== undefined) {
      const parsed = await parseSourceToAst(predicate, CliLanguage.Pattern);
      if (!parsed.ok) {
        return {
          ok: false,
          error: {
            code: SessionQueryFailureCode.ParseFailure,
            phase: "parse",
            message: parsed.error.message,
          },
        };
      }
      pattern = parsed.ast as Pattern;
    }

    const matches: SessionQueryMatch[] = [];
    // Only each module's own `rules`/`funcs` — never `imports`/
    // `decoratorImports` — are scanned: an import is an alias for a Rule/Func
    // that's already reachable (and already scanned) via its origin module in
    // `this.modules`, so walking imports too would report the same
    // metadata twice under a second name.
    for (const [href, module] of this.modules) {
      const members: [string, "rule" | "func", Rule | Func][] = [
        ...[...module.rules].map(
          ([n, r]): [string, "rule" | "func", Rule | Func] => [n, "rule", r],
        ),
        ...[...module.funcs].map(
          ([n, f]): [string, "rule" | "func", Rule | Func] => [n, "func", f],
        ),
      ];
      for (const [name, kind, member] of members) {
        const metadata = member.metadata;
        // Own-key only: `in` is true for inherited Object.prototype names
        // (`constructor`, `toString`, …), which would treat every decorated
        // rule/func as a hit for a decorator that was never applied.
        if (!metadata || !Object.hasOwn(metadata, decorator)) continue;
        const value = metadata[decorator];
        if (pattern) {
          const result = await match(pattern, Scope.From(value));
          if (result.kind !== MatchKind.Ok) continue;
        }
        matches.push({ moduleUrl: href, name, kind, metadata: value });
      }
    }

    return { ok: true, matches };
  }

  /** Retains a rule invocation's match result tree for later `walk()` calls,
   * returning the stable id it's stored under. */
  private retainMatchResult(result: Match): string {
    const id = String(this.nextMatchResultId++);
    this.matchResults.set(id, result);
    return id;
  }

  /**
   * Looks up a previously retained match result tree by id (see
   * {@link retainMatchResult}), for consumers other than `walk()` that need
   * the raw tree — for example the session display surface tool's
   * Match-to-HTML transform (see
   * `.agents/requirements/mcp-server/011-session-display-surface-tool.requirement.md`).
   * Returns `undefined` for an unknown id, mirroring `walk()`'s own lookup.
   */
  public getMatchResult(matchResultId: string): Match | undefined {
    return this.matchResults.get(matchResultId);
  }

  /**
   * Traverses a retained match result tree (see {@link retainMatchResult})
   * in deterministic, bounded windows — see
   * `.agents/requirements/mcp-server/008-match-tree-walking-tool.requirement.md`.
   * Read-only: never mutates the retained tree.
   */
  public walk(input: SessionWalkInput): SessionWalkResult {
    if (this.closed) {
      throw new Error(`Session ${this.id} is closed`);
    }

    const root = this.matchResults.get(input.matchResultId);
    if (!root) {
      return {
        ok: false,
        error: {
          code: SessionWalkFailureCode.UnknownMatchResult,
          phase: "input",
          message: `No retained match result with id '${input.matchResultId}'`,
        },
      };
    }

    const path = input.path ?? [];
    const maxNodes = input.maxNodes ?? 50;
    const maxDepth = input.maxDepth;

    // Navigate from the tree's root to the requested start node, keeping
    // the ancestor chain (inclusive of the start node) for metadata
    // resolution — see rule-metadata.spec.md#metadata-resolution.
    let start = root;
    const ancestry: Match[] = [root];
    for (const index of path) {
      if (start.kind !== MatchKind.Ok && start.kind !== MatchKind.Fail) {
        return {
          ok: false,
          error: {
            code: SessionWalkFailureCode.InvalidPath,
            phase: "input",
            message:
              `Path index ${index} is invalid: a '${start.kind}' node has no children`,
          },
        };
      }
      const child: Match | undefined = start.matches[index];
      if (!child) {
        return {
          ok: false,
          error: {
            code: SessionWalkFailureCode.InvalidPath,
            phase: "input",
            message:
              `Path index ${index} is out of range (node has ${start.matches.length} children)`,
          },
        };
      }
      start = child;
      ancestry.push(start);
    }

    const nodes: SessionWalkNode[] = [];
    let truncated = false;

    const visit = (
      node: Match,
      nodePath: number[],
      nodeAncestry: Match[],
      depth: number,
    ): void => {
      if (nodes.length >= maxNodes) {
        truncated = true;
        return;
      }
      nodes.push(projectWalkNode(node, nodePath, nodeAncestry));

      const hasChildren = node.kind === MatchKind.Ok ||
        node.kind === MatchKind.Fail;
      if (!hasChildren) return;
      const children = (node as { matches: Match[] }).matches;
      if (children.length === 0) return;

      if (maxDepth !== undefined && depth >= maxDepth) {
        truncated = true;
        return;
      }

      for (let i = 0; i < children.length; i++) {
        if (nodes.length >= maxNodes) {
          truncated = true;
          return;
        }
        visit(
          children[i],
          [...nodePath, i],
          [...nodeAncestry, children[i]],
          depth + 1,
        );
      }
    };

    visit(start, path, ancestry, 0);
    return { ok: true, nodes, truncated };
  }

  /** Releases this session's in-memory state. Idempotent. */
  public close(): void {
    this.declarations.clear();
    this.modules.clear();
    this.moduleOrder.length = 0;
    this.lastLoadedRootHref = undefined;
    this.lastParseHref = undefined;
    this.parseStates.clear();
    this.matchResults.clear();
    this.closed = true;
  }
}

/** Builds one `SessionWalkNode` from a `Match`, its path from the walked
 * tree's root, and the ancestor chain (inclusive of `node` itself) used to
 * resolve its accumulated decorator metadata. */
function projectWalkNode(
  node: Match,
  path: number[],
  ancestry: Match[],
): SessionWalkNode {
  const metadata: SessionWalkMetadataContribution[] = [];
  for (const ancestor of ancestry) {
    if (ancestor.kind !== MatchKind.Ok && ancestor.kind !== MatchKind.Fail) {
      continue;
    }
    const rule = ancestor.origin?.rule;
    if (rule?.metadata) {
      metadata.push({ rule: rule.name, metadata: rule.metadata });
    }
  }

  const variables = Object.fromEntries(node.scope.variables.entries());

  switch (node.kind) {
    case MatchKind.Ok:
      return {
        path,
        kind: "ok",
        pattern: node.pattern,
        normalizedSpan: node.normalizedSpan,
        originalSpan: node.originalSpan,
        value: node.value,
        childCount: node.matches.length,
        rule: node.origin?.rule.name,
        variables,
        metadata,
      };
    case MatchKind.Fail:
      return {
        path,
        kind: "fail",
        pattern: node.pattern,
        normalizedSpan: node.normalizedSpan,
        originalSpan: node.originalSpan,
        childCount: node.matches.length,
        rule: node.origin?.rule.name,
        variables,
        metadata,
      };
    case MatchKind.Error:
      return {
        path,
        kind: "error",
        pattern: node.pattern,
        normalizedSpan: node.normalizedSpan,
        originalSpan: node.originalSpan,
        code: node.code,
        message: node.message,
        childCount: 0,
        variables,
        metadata,
      };
    case MatchKind.LR:
      return {
        path,
        kind: "lr",
        pattern: node.pattern,
        childCount: 0,
        variables,
        metadata,
      };
  }
}
