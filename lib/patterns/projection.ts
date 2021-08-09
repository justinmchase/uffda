import { log } from '../../deps/std.ts'
import { Match } from '../match.ts'
import { Scope } from '../scope.ts'
import { Pattern } from './pattern.ts'

export interface IProjectionArgs<T, TVars> {
  pattern: Pattern,
  expr: (arg: { _: T } & TVars) => unknown
}

// deno-lint-ignore no-explicit-any
export function projection<T, TVars extends Record<PropertyKey, any>>(args: IProjectionArgs<T, TVars>) {
  const { pattern, expr } = args
  return function projection(scope: Scope) {
    log.debug(`- projection@${scope.stream.path}`)
    const match = pattern(scope)
    if (!match.matched)
      return match

    const variables = Object.assign({}, match.end.variables, { _: match.value })
    const value = expr(variables)
    return Match.Ok(scope, match.end, value)
  }
}
