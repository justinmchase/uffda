import debug from 'debug'
import { Scope } from '../scope'

const trace = debug('trace')

export function reference(name: string) {
  return function reference(scope: Scope) {
    trace('- ref', name, scope.variables[name])
    const p = scope.variables[name]
    return p(scope)
  }
}
