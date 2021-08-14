import { Match } from '../../match.ts'
import { Scope } from '../../scope.ts'
import { IErrorUntilPattern } from './pattern.ts'
import { match } from '../match.ts'

export function error(args: IErrorUntilPattern, scope: Scope): Match {
  const { pattern } = args
  let end = scope
  let m = Match.Fail(scope)
  while (!end.stream.done) {
    m = match(pattern, end)
    if (m.matched)
      break

    const next = end.stream.next()
    end = scope.withStream(next)
  }

  return m.setValue(undefined).pushError(scope, end)
}
