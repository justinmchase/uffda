import { Match } from '../../match.ts'
import { Scope } from '../../scope.ts'
import { match } from '../match.ts'
import { IThenPattern } from './pattern.ts'

export function then(args: IThenPattern, scope: Scope): Match {
  const { patterns } = args
  let end = scope
  const values: unknown[] = []
  for (const pattern of patterns) {
    const m = match(pattern, end)
    if (!m.matched)
      return m

    end = m.end
    values.push(m.value)
  }

  return Match.Ok(scope, end, values)
}
