import { Scope } from "../scope.ts";
import { Match } from "../match.ts";
import {
  and,
  any,
  array,
  block,
  equal,
  error,
  fail,
  includes,
  must,
  not,
  object,
  ok,
  or,
  Pattern,
  PatternKind,
  pipeline,
  projection,
  reference,
  regexp,
  rule,
  slice,
  special,
  then,
  type,
  ValueType,
  variable,
} from "./patterns/mod.ts";

export function match(pattern: Pattern, scope: Scope): Match {
  // console.log(`${pattern.kind}@${scope.stream.path}: ${Deno.inspect(scope.stream.value, { colors: true })}`)
  switch (pattern.kind) {
    case PatternKind.And:
      return and(pattern, scope);
    case PatternKind.Any:
      return any(scope);
    case PatternKind.Array:
      return array(pattern, scope);
    case PatternKind.Block:
      return block(pattern, scope);
    case PatternKind.Boolean:
      return type(ValueType.Boolean, scope);
    case PatternKind.ErrorUntil:
      return error(pattern, scope);
    case PatternKind.Equal:
      return equal(pattern, scope);
    case PatternKind.Fail:
      return fail(scope);
    case PatternKind.Includes:
      return includes(pattern, scope);
    case PatternKind.Must:
      return must(pattern, scope);
    case PatternKind.Not:
      return not(pattern, scope);
    case PatternKind.Number:
      return type(ValueType.Number, scope);
    case PatternKind.Object:
      return object(pattern, scope);
    case PatternKind.Ok:
      return ok(scope);
    case PatternKind.Or:
      return or(pattern, scope);
    case PatternKind.Pipeline:
      return pipeline(pattern, scope);
    case PatternKind.Projection:
      return projection(pattern, scope);
    case PatternKind.Reference:
      return reference(pattern, scope);
    case PatternKind.RegExp:
      return regexp(pattern, scope);
    case PatternKind.Rule:
      return rule(pattern, scope);
    case PatternKind.Slice:
      return slice(pattern, scope);
    case PatternKind.Special:
      return special(pattern, scope);
    case PatternKind.String:
      return type(ValueType.String, scope);
    case PatternKind.Then:
      return then(pattern, scope);
    case PatternKind.Variable:
      return variable(pattern, scope);
  }
}
