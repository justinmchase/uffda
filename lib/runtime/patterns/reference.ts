import { Scope } from '../../scope.ts'
import { Match } from '../../match.ts'
import { match } from '../match.ts'
import { IReferencePattern } from './pattern.ts'

export function reference(args: IReferencePattern, scope: Scope): Match {
  const { name } = args
  const p = scope.variables[name]
  const s = scope.pushRef(name)
  const m = match(p, s)
  // console.log(`${scope.stream.path} (${Deno.inspect(scope.stream.value, { colors: true, depth: 10 })}) match (${name})`)
  return m.popRef(scope)
}
