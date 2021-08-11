import { Match } from '../../match.ts'
import { ISpecialReferenceExpression } from './expression.ts'

export function special(expression: ISpecialReferenceExpression, match: Match): unknown {
  const { name } = expression
  const special = match.end.getSpecial(name)
  if (typeof special === 'function') {
    const variables = Object.assign({}, match.end.variables, { _: match.value })
    return special(variables)
  } else {
    return special
  }
}