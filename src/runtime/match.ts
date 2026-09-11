import type { Scope } from "./scope.ts";
import { fail } from "../match.ts";
import type { AwaitableMatch } from "./awaitable.ts";
import {
  and,
  any,
  between,
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
  then,
  type,
  variable,
} from "./patterns/mod.ts";

export async function match(pattern: Pattern, scope: Scope): AwaitableMatch {
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
    case PatternKind.Then:
      return await then(pattern, scope);
    case PatternKind.Type:
      return await type(pattern, scope);
    case PatternKind.Variable:
      return await variable(pattern, scope);
    default:
      return fail(scope, pattern);
  }
}
