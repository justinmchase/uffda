import debug from 'debug'
import { Scope } from '../scope'
import { ok } from './ok'
import { Pattern } from './pattern'

const trace = debug('trace')

export function block(variables: Record<string, Pattern>) {
  const Main = variables['Main'] ?? Object.entries(variables).pop()?.[1] ?? ok
  return function block(scope: Scope) {
    trace('- block', Main)
    const subScope = scope
      .addVariables(variables)
      .push()

    const result = Main(subScope)
    if (!result.matched)
      return result

    return result.popBlock()
  }
}
