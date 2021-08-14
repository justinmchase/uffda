import { Scope } from '../../scope.ts'
import { Match } from '../../match.ts'
import { match } from '../match.ts'
import { IBlockPattern } from './pattern.ts'

export function block(args: IBlockPattern, scope: Scope): Match {
  const { variables } = args
  const pattern = Object.entries(variables).pop()?.[1]
  if (pattern) {
    const subScope = scope
      .addVariables(variables)
      .push()

    const result = match(pattern, subScope)
    return result.popBlock()
  } else {
    return Match.Ok(scope, scope, undefined)
  }
}
