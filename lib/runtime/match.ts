import { Scope } from '../scope.ts'
import { Match } from '../match.ts'
import {
  Pattern,
  PatternKind,
  and,
  any,
  array,
  block,
  error,
  equal,
  fail,
  includes,
  not,
  number,
  object,
  ok,
  or,
  pipeline,
  projection,
  reference,
  regexp,
  rule,
  slice,
  string,
  then,
  variable,
} from './patterns/mod.ts'

export function match(pattern: Pattern, scope: Scope): Match {
  // console.log(`${pattern.kind}@${scope.stream.path}: ${Deno.inspect(scope.stream.value, { colors: true })}`)
  switch(pattern.kind) {
    case PatternKind.And:
      return and(pattern, scope)
    case PatternKind.Any:
      return any(scope)
    case PatternKind.Array:
      return array(pattern, scope)
    case PatternKind.Block:
      return block(pattern, scope)
    case PatternKind.ErrorUntil:
      return error(pattern, scope)
    case PatternKind.Equal:
      return equal(pattern, scope)
    case PatternKind.Fail:
      return fail(scope)
    case PatternKind.Includes:
      return includes(pattern, scope)
    case PatternKind.Not:
      return not(pattern, scope)
    case PatternKind.Number:
      return number(scope)
    case PatternKind.Object:
      return object(pattern, scope)
    case PatternKind.Ok:
      return ok(scope)
    case PatternKind.Or:
      return or(pattern, scope)
    case PatternKind.Pipeline:
      return pipeline(pattern, scope)
    case PatternKind.Projection:
      return projection(pattern, scope)
    case PatternKind.Reference:
      return reference(pattern, scope)
    case PatternKind.RegExp:
      return regexp(pattern, scope)
    case PatternKind.Rule:
      return rule(pattern, scope)
    case PatternKind.Slice:
      return slice(pattern, scope)
    case PatternKind.String:
      return string(scope)
    case PatternKind.Then:
      return then(pattern, scope)
    case PatternKind.Variable:
      return variable(pattern, scope)
  }
}