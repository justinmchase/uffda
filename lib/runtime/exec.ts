import { Match } from '../match.ts'
import { Expression, ExpressionKind, native, special } from './expressions/mod.ts'

export function exec(expression: Expression, match: Match): unknown {
  switch (expression.kind) {
    case ExpressionKind.Native:
      return native(expression, match)
    case ExpressionKind.SpecialReference:
      return special(expression, match)
  }
}