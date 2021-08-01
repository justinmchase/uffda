import { log } from '../../deps/std.ts'
import { Scope } from '../scope.ts'
import { ok } from './ok.ts'
import { Pattern } from './pattern.ts'

export function block(variables: Record<string, Pattern>) {
  const Main = variables['Main'] ?? Object.entries(variables).pop()?.[1] ?? ok
  return function block(scope: Scope) {
    log.debug('- block', Main)
    const subScope = scope
      .addVariables(variables)
      .push()

    const result = Main(subScope)
    if (!result.matched)
      return result

    return result.popBlock()
  }
}
