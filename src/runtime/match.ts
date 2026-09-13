import type { Scope } from "./scope.ts";
import type { AwaitableMatch } from "./awaitable.ts";
import type { CompiledPattern } from "./compiled_pattern.ts";
import {
  buildAnd,
  buildAny,
  buildBetween,
  buildCharacter,
  buildEnd,
  buildEqual,
  buildExcept,
  buildFail,
  buildIncludes,
  buildInto,
  buildLookahead,
  buildMaybe,
  buildNot,
  buildOk,
  buildOr,
  buildOver,
  buildPipeline,
  buildProjection,
  buildQuantifier,
  buildRegExp,
  buildResolve,
  buildSwitch,
  buildThen,
  buildType,
  buildVariable,
  type Pattern,
  PatternKind,
} from "./patterns/mod.ts";

export type { CompiledPattern } from "./compiled_pattern.ts";

/**
 * Compiles a pattern node into a closure once and caches it on `scope`'s
 * `Resolver` instance (see `Resolver.compilePattern`), so a rule's pattern
 * tree only ever pays the "which kind is this, and what does it statically
 * need" cost a single time per runtime instance, no matter how many times
 * the rule is matched. The cache lives on the `Resolver` — not as
 * module-level global state — so independently constructed runtimes never
 * share compiled closures with one another.
 *
 * Every pattern kind has a specialized flattened implementation, each
 * defined alongside its `pattern.ts` counterpart in its own
 * `./patterns/*.ts` file (as `build*`). Composite kinds (for example
 * `Then`/`And`/`Or`/`Switch`/`Pipeline`) recurse into {@link compile} for
 * their static children at build time, so an entire rule's pattern tree is
 * flattened into nested closures the first time it is compiled; only
 * kinds whose target genuinely depends on the invocation `Scope` (for
 * example `Resolve`) still resolve that target per invocation.
 */
export function compile(pattern: Pattern, scope: Scope): CompiledPattern {
  return scope.options.resolver.compilePattern(
    pattern,
    () => build(pattern, scope),
  );
}

function build(pattern: Pattern, scope: Scope): CompiledPattern {
  switch (pattern.kind) {
    case PatternKind.And:
      return buildAnd(pattern, scope);
    case PatternKind.Any:
      return buildAny(pattern);
    case PatternKind.Between:
      return buildBetween(pattern);
    case PatternKind.Character:
      return buildCharacter(pattern);
    case PatternKind.End:
      return buildEnd(pattern);
    case PatternKind.Equal:
      return buildEqual(pattern);
    case PatternKind.Except:
      return buildExcept(pattern, scope);
    case PatternKind.Fail:
      return buildFail(pattern);
    case PatternKind.Includes:
      return buildIncludes(pattern);
    case PatternKind.Into:
      return buildInto(pattern, scope);
    case PatternKind.Lookahead:
      return buildLookahead(pattern, scope);
    case PatternKind.Maybe:
      return buildMaybe(pattern, scope);
    case PatternKind.Not:
      return buildNot(pattern, scope);
    case PatternKind.Ok:
      return buildOk(pattern);
    case PatternKind.Or:
      return buildOr(pattern, scope);
    case PatternKind.Over:
      return buildOver(pattern, scope);
    case PatternKind.Pipeline:
      return buildPipeline(pattern, scope);
    case PatternKind.Projection:
      return buildProjection(pattern, scope);
    case PatternKind.Quantifier:
      return buildQuantifier(pattern, scope);
    case PatternKind.RegExp:
      return buildRegExp(pattern);
    case PatternKind.Resolve:
      return buildResolve(pattern);
    case PatternKind.Switch:
      return buildSwitch(pattern, scope);
    case PatternKind.Then:
      return buildThen(pattern, scope);
    case PatternKind.Type:
      return buildType(pattern);
    case PatternKind.Variable:
      return buildVariable(pattern, scope);
  }
}

export function match(pattern: Pattern, scope: Scope): AwaitableMatch {
  return compile(pattern, scope)(scope);
}
