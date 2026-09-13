import { type } from "@justinmchase/type";
import type { Scope } from "./scope.ts";
import {
  error,
  fail,
  type Match,
  MatchErrorCode,
  MatchKind,
  ok,
} from "../match.ts";
import type { AwaitableMatch } from "./awaitable.ts";
import {
  and,
  any,
  between,
  character,
  characterClassToRegexp,
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

/**
 * A pattern node compiled once (see {@link compile}) into a closure that
 * matches it directly against a `Scope`, without going back through
 * `interpret`'s per-call `switch (pattern.kind)` dispatch.
 */
export type CompiledPattern = (scope: Scope) => AwaitableMatch;

const compiledCache = new WeakMap<Pattern, CompiledPattern>();

/**
 * Compiles a pattern node into a closure once and caches it on the node
 * itself (keyed by object identity via `WeakMap`), so a rule's pattern tree
 * only ever pays the "which kind is this, and what does it statically need"
 * cost a single time, no matter how many times the rule is matched.
 *
 * Only a pilot set of high call-volume, structurally simple kinds
 * (`Then`, `And`, `Or`, `Character`, `Variable`, `Type`) have a specialized
 * flattened implementation today; every other kind falls back to
 * {@link interpret}, the original generic per-call dispatcher, so this is
 * always correct even for pattern kinds not yet compiled. Flattened
 * composite kinds (`Then`/`And`/`Or`) still recurse into {@link compile} for
 * their children, so compiled and interpreted subtrees can be freely mixed
 * within the same rule.
 */
export function compile(pattern: Pattern): CompiledPattern {
  let compiled = compiledCache.get(pattern);
  if (!compiled) {
    compiled = build(pattern);
    compiledCache.set(pattern, compiled);
  }
  return compiled;
}

function build(pattern: Pattern): CompiledPattern {
  switch (pattern.kind) {
    case PatternKind.Then: {
      const { patterns } = pattern;
      const children = patterns.map(compile);
      return async (scope: Scope): AwaitableMatch => {
        let end = scope;
        const matches: Match[] = [];
        const values: unknown[] = [];
        for (let i = 0; i < children.length; i++) {
          const m = await children[i](end);
          matches.push(m);
          switch (m.kind) {
            case MatchKind.LR:
            case MatchKind.Error:
              return m;
            case MatchKind.Fail:
              return fail(scope, patterns[i], matches);
            case MatchKind.Ok:
              values.push(m.value);
              end = m.scope;
              break;
          }
        }
        return ok(scope, end, pattern, values, matches);
      };
    }
    case PatternKind.And: {
      const { patterns } = pattern;
      const children = patterns.map(compile);
      return async (scope: Scope): AwaitableMatch => {
        let s = scope;
        const matches: Extract<Match, { kind: MatchKind.Ok }>[] = [];
        for (let i = 0; i < children.length; i++) {
          const m = await children[i](s);
          switch (m.kind) {
            case MatchKind.LR:
            case MatchKind.Error:
              return m;
            case MatchKind.Fail:
              return fail(scope, patterns[i], [...matches, m]);
            case MatchKind.Ok:
              matches.push(m);
              s = s.addVariables(m.scope.variables);
              break;
          }
        }
        const last = matches.slice(-1)?.[0];
        return ok(s, last?.scope ?? s, pattern, last?.value, matches);
      };
    }
    case PatternKind.Or: {
      const { patterns } = pattern;
      const children = patterns.map(compile);
      return async (scope: Scope): AwaitableMatch => {
        const matches: Match[] = [];
        for (let i = 0; i < children.length; i++) {
          const m = await children[i](scope);
          matches.push(m);
          switch (m.kind) {
            case MatchKind.LR:
            case MatchKind.Error:
              return m;
            case MatchKind.Fail:
              break;
            case MatchKind.Ok:
              return ok(scope, m.scope, pattern, m.value, matches);
          }
        }
        return fail(scope, pattern, matches);
      };
    }
    case PatternKind.Character: {
      const { characterClass } = pattern;
      const regexp = characterClassToRegexp(characterClass);
      return async (scope: Scope): AwaitableMatch => {
        if (!regexp) {
          return error(
            scope,
            pattern,
            MatchErrorCode.InvalidArgument,
            `unknown character class ${characterClass}`,
          );
        }
        if (await scope.stream.done()) {
          return fail(scope, pattern);
        }
        const next = await scope.stream.next();
        if (typeof next.value !== "string") {
          return error(
            scope,
            pattern,
            MatchErrorCode.Type,
            `expected value to be a string but got ${typeof next.value}`,
          );
        }
        if (!regexp.test(next.value)) {
          return fail(scope, pattern);
        }
        return ok(scope, scope.withInput(next), pattern, next.value);
      };
    }
    case PatternKind.Variable: {
      const { name } = pattern;
      const child = compile(pattern.pattern);
      return async (scope: Scope): AwaitableMatch => {
        if (scope.variables.has(name)) {
          return error(
            scope,
            pattern,
            MatchErrorCode.DuplicateVariable,
            `Variable ${name} already exists in scope`,
          );
        }
        const m = await child(scope);
        switch (m.kind) {
          case MatchKind.LR:
          case MatchKind.Error:
            return m;
          case MatchKind.Fail:
            return fail(scope, pattern, [m]);
          case MatchKind.Ok:
            return ok(
              scope,
              m.scope.addVariables({ [name]: m.value }),
              pattern,
              m.value,
              [m],
            );
        }
        return error(
          scope,
          pattern,
          MatchErrorCode.InvalidArgument,
          `unexpected match kind ${
            (m as { kind?: unknown }).kind
          } in variable child pattern`,
        );
      };
    }
    case PatternKind.Type: {
      const { type: expectedType } = pattern;
      return async (scope: Scope): AwaitableMatch => {
        if (await scope.stream.done()) {
          return fail(scope, pattern);
        }
        const end = await scope.stream.next();
        const [actualType] = type(end.value);
        if (actualType === expectedType) {
          return ok(scope, scope.withInput(end), pattern, end.value);
        }
        return fail(scope, pattern);
      };
    }
    default:
      return (scope: Scope) => interpret(pattern, scope);
  }
}

export function match(pattern: Pattern, scope: Scope): AwaitableMatch {
  return compile(pattern)(scope);
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
