import { assert } from '../../deps/std.ts'
import { Match } from '../match.ts'
import { Scope } from '../scope.ts'
import { any } from './any.ts'
import { Pattern } from './pattern.ts'

interface IRangeArgs {
  min?: number,
  max?: number,
  pattern?: Pattern,
}

export function slice(args: IRangeArgs) {
  const { min, max, pattern = any() } = args
  if (min != null) {
    assert(min >= 0, `min must be 0 or greater but is ${min}`)
    assert((min % 1) === 0, `min must be an integer but is ${min}`)
  }

  if (max != null) {
    assert(max >= 0, `max must be 0 or greater but is ${max}`)
    assert((max % 1) === 0, `max must be an integer but is ${max}`)
  }

  return function slice(scope: Scope) {
    let end: Scope = scope
    const matches: unknown[] = []
    while (true) {
      const match = pattern(end)

      // The pattern must match successfully
      if (!match.matched)
        break

      // This prevents infinite recursion for Patterns which succeed
      // but consume no input, such as `not` or `ok`
      //
      // For example (!any)* or ok+
      //
      // This will consume no input but it will succeed
      if (match.end.stream.path.compareTo(end.stream.path) <= 0)
        break

      end = match.end
      matches.push(match.value)
      if (max != null && matches.length >= max)
        break
    }

    if (!min || matches.length >= min) {
      return Match.Ok(scope, end, matches)
    } else {
      return Match.Fail(scope)
    }
  }
}
