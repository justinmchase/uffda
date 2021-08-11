import { Scope } from '../../scope.ts'
import { Match } from '../../match.ts'
import { match } from '../match.ts'
import { IReferencePattern } from './pattern.ts'

export function reference(args: IReferencePattern, scope: Scope): Match {
  const { name } = args
  const p = scope.variables[name]
  
  // console.log(`${name}@${scope.stream.path}`)
  return match(p, scope)
}
