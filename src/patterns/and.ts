import { ok } from 'assert'
import { Match } from '../match'
import { Scope } from '../scope'
import { Pattern } from './pattern'

interface IAndArgs {
  patterns: Pattern[]
}

/**
 * All patterns must match the same input value, the result of the last pattern is returned
 * or the first failure.
 * @param args.patterns The patterns that must match, at least 1 is required
 * @returns An and Pattern function
 */
export function and(args: IAndArgs) {
  const { patterns } = args
  ok(patterns.length > 0, `At least one pattern must be specified but found ${patterns.length}`)
  return function and(scope: Scope) {
    let match = Match.Fail(scope)
    for (const pattern of patterns) {
      const result = pattern(scope)
      if (!result.matched)
        return result

      match = result
      scope = scope
        .addVariables(match.end.variables)
    }

    return match
  }
}

