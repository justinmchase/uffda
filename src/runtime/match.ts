import type { Scope } from "./scope.ts";
import type { AwaitableMatch } from "./awaitable.ts";
import type { CompiledPattern } from "./compiled_pattern.ts";
import {
  and,
  any,
  between,
  buildResolve,
  character,
  end,
  equal,
  except,
  fail,
  includes,
  into,
  lookahead,
  maybe,
  not,
  ok,
  or,
  over,
  type Pattern,
  PatternKind,
  pipeline,
  projection,
  quantifier,
  regexp,
  switchPattern,
  then,
  type as typePattern,
  variable,
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
 * Every pattern kind has a specialized flattened implementation, defined
 * alongside its `pattern.ts` counterpart in its own `./patterns/*.ts` file
 * (there is exactly one such function per kind — no separate interpreted
 * entry point). Composite kinds (for example `Then`/`And`/`Or`/`Switch`/
 * `Pipeline`) recurse into {@link compile} for their static children at
 * build time, so an entire rule's pattern tree is flattened into nested
 * closures the first time it is compiled; only kinds whose target
 * genuinely depends on the invocation `Scope` (for example `Resolve`)
 * still resolve that target per invocation.
 */
export function compile(pattern: Pattern, scope: Scope): CompiledPattern {
  return scope.options.resolver.compilePattern(pattern, () => {
    switch (pattern.kind) {
      case PatternKind.And:
        return and(pattern, scope);
      case PatternKind.Any:
        return any(pattern);
      case PatternKind.Between:
        return between(pattern);
      case PatternKind.Character:
        return character(pattern);
      case PatternKind.End:
        return end(pattern);
      case PatternKind.Equal:
        return equal(pattern);
      case PatternKind.Except:
        return except(pattern, scope);
      case PatternKind.Fail:
        return fail(pattern);
      case PatternKind.Includes:
        return includes(pattern);
      case PatternKind.Into:
        return into(pattern, scope);
      case PatternKind.Lookahead:
        return lookahead(pattern, scope);
      case PatternKind.Maybe:
        return maybe(pattern, scope);
      case PatternKind.Not:
        return not(pattern, scope);
      case PatternKind.Ok:
        return ok(pattern);
      case PatternKind.Or:
        return or(pattern, scope);
      case PatternKind.Over:
        return over(pattern, scope);
      case PatternKind.Pipeline:
        return pipeline(pattern, scope);
      case PatternKind.Projection:
        return projection(pattern, scope);
      case PatternKind.Quantifier:
        return quantifier(pattern, scope);
      case PatternKind.RegExp:
        return regexp(pattern);
      case PatternKind.Resolve:
        return buildResolve(pattern);
      case PatternKind.Switch:
        return switchPattern(pattern, scope);
      case PatternKind.Then:
        return then(pattern, scope);
      case PatternKind.Type:
        return typePattern(pattern);
      case PatternKind.Variable:
        return variable(pattern, scope);
    }
  });
}

export function match(pattern: Pattern, scope: Scope): AwaitableMatch {
  return compile(pattern, scope)(scope);
}
