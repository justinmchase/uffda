import { ok } from 'assert'
import { Match } from '../match'
import { Scope } from '../scope'
import { any } from './any'
import { Pattern } from './pattern'

interface IRangeArgs {
  min?: number,
  max?: number,
  pattern?: Pattern,
}

export function slice(args: IRangeArgs) {
  const { min, max, pattern = any } = args
  if (min != null) {
    ok(min >= 0, `min must be 0 or greater but is ${min}`)
    ok((min % 1) === 0, `min must be an integer but is ${min}`)
  }

  if (max != null) {
    ok(max >= 0, `max must be 0 or greater but is ${max}`)
    ok((max % 1) === 0, `max must be an integer but is ${max}`)
  }

  return function slice(scope: Scope) {
    let end: Scope = scope
    const matches: any[] = []
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
