import { log } from '../../deps/std.ts'
import { Scope } from '../scope.ts'

export function reference(name: string) {
  return function reference(scope: Scope) {
    log.debug('- ref', name, scope.variables[name])
    const p = scope.variables[name]
    return p(scope)
  }
}
