import type { Scope } from "./scope.ts";
import { fail } from "../match.ts";
import type { AwaitableMatch } from "./awaitable.ts";
import type { CompiledPattern } from "./compiled_pattern.ts";
import {
  and,
  any,
  between,
  buildAnd,
  buildCharacter,
  buildOr,
  buildThen,
  buildType,
  buildVariable,
  character,
  end,
  equal,
  except,
  fail as failPattern,
  includes,
  into,
  lookahead,
  maybe,
  not,
  ok as okPattern,
  or,
  over,
  type Pattern,
  PatternKind,
  pipeline,
  projection,
  quantifier,
  regexp,
  resolve,
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
 * Only a pilot set of high call-volume, structurally simple kinds
 * (`Then`, `And`, `Or`, `Character`, `Variable`, `Type`) have a specialized
 * flattened implementation today, each defined alongside its interpreted
 * counterpart in its own `./patterns/*.ts` file (as `build*`). Every other
 * kind falls back to {@link interpret}, the original generic per-call
 * dispatcher, so this is always correct even for pattern kinds not yet
 * compiled. Flattened composite kinds (`Then`/`And`/`Or`) still recurse into
 * {@link compile} for their children, so compiled and interpreted subtrees
 * can be freely mixed within the same rule.
 */
export function compile(pattern: Pattern, scope: Scope): CompiledPattern {
  return scope.options.resolver.compilePattern(
    pattern,
    () => build(pattern, scope),
  );
}

function build(pattern: Pattern, scope: Scope): CompiledPattern {
  switch (pattern.kind) {
    case PatternKind.Then:
      return buildThen(pattern, scope);
    case PatternKind.And:
      return buildAnd(pattern, scope);
    case PatternKind.Or:
      return buildOr(pattern, scope);
    case PatternKind.Character:
      return buildCharacter(pattern);
    case PatternKind.Variable:
      return buildVariable(pattern, scope);
    case PatternKind.Type:
      return buildType(pattern);
    default:
      return (s: Scope) => interpret(pattern, s);
  }
}

export function match(pattern: Pattern, scope: Scope): AwaitableMatch {
  return compile(pattern, scope)(scope);
}

async function interpret(pattern: Pattern, scope: Scope): AwaitableMatch {
  switch (pattern.kind) {
    case PatternKind.And:
      return await and(pattern, scope);
    case PatternKind.Any:
      return await any(pattern, scope);
    case PatternKind.Between:
      return await between(pattern, scope);
    case PatternKind.Into:
      return await into(pattern, scope);
    case PatternKind.Character:
      return await character(pattern, scope);
    case PatternKind.End:
      return await end(pattern, scope);
    case PatternKind.Equal:
      return await equal(pattern, scope);
    case PatternKind.Except:
      return await except(pattern, scope);
    case PatternKind.Fail:
      return failPattern(pattern, scope);
    case PatternKind.Includes:
      return await includes(pattern, scope);
    case PatternKind.Lookahead:
      return await lookahead(pattern, scope);
    case PatternKind.Maybe:
      return await maybe(pattern, scope);
    case PatternKind.Not:
      return await not(pattern, scope);
    case PatternKind.Over:
      return await over(pattern, scope);
    case PatternKind.Ok:
      return okPattern(pattern, scope);
    case PatternKind.Or:
      return await or(pattern, scope);
    case PatternKind.Pipeline:
      return await pipeline(pattern, scope);
    case PatternKind.Projection:
      return await projection(pattern, scope);
    case PatternKind.Quantifier:
      return await quantifier(pattern, scope);
    case PatternKind.RegExp:
      return await regexp(pattern, scope);
    case PatternKind.Resolve:
      return await resolve(pattern, scope);
    case PatternKind.Switch:
      return await switchPattern(pattern, scope);
    case PatternKind.Then:
      return await then(pattern, scope);
    case PatternKind.Type:
      return await typePattern(pattern, scope);
    case PatternKind.Variable:
      return await variable(pattern, scope);
    default:
      return fail(scope, pattern);
  }
}
