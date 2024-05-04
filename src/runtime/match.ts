import { Scope } from "./scope.ts";
import { fail, Match } from "../match.ts";
import {
  and,
  any,
  array,
  character,
  end,
  equal,
  fail as failp,
  includes,
  not,
  object,
  ok,
  or,
  Pattern,
  PatternKind,
  pipeline,
  projection,
  range,
  reference,
  regexp,
  slice,
  special,
  then,
  type,
  variable,
} from "./patterns/mod.ts";

export function match(pattern: Pattern, scope: Scope): Match {
  switch (pattern.kind) {
    case PatternKind.And:
      return and(pattern, scope);
    case PatternKind.Any:
      return any(pattern, scope);
    case PatternKind.Array:
      return array(pattern, scope);
    case PatternKind.Character:
      return character(pattern, scope);
    case PatternKind.End:
      return end(pattern, scope);
    case PatternKind.Equal:
      return equal(pattern, scope);
    case PatternKind.Fail:
      return failp(pattern, scope);
    case PatternKind.Includes:
      return includes(pattern, scope);
    case PatternKind.Not:
      return not(pattern, scope);
    case PatternKind.Object:
      return object(pattern, scope);
    case PatternKind.Ok:
      return ok(pattern, scope);
    case PatternKind.Or:
      return or(pattern, scope);
    case PatternKind.Pipeline:
      return pipeline(pattern, scope);
    case PatternKind.Projection:
      return projection(pattern, scope);
    case PatternKind.Range:
      return range(pattern, scope);
    case PatternKind.Reference:
      return reference(pattern, scope);
    case PatternKind.RegExp:
      return regexp(pattern, scope);
    case PatternKind.Slice:
      return slice(pattern, scope);
    case PatternKind.Special:
      return special(pattern, scope);
    case PatternKind.Then:
      return then(pattern, scope);
    case PatternKind.Type:
      return type(pattern, scope);
    case PatternKind.Variable:
      return variable(pattern, scope);
    default:
      return fail(scope, pattern);
  }
}
