import { Pattern, PatternKind } from '../../runtime/patterns/mod.ts'
import { ExpressionKind } from '../../runtime/expressions/mod.ts'
import { Digit } from './Digit.ts'

export const Integer: Pattern = {
  kind: PatternKind.Projection,
  pattern: {
    kind: PatternKind.Slice,
    min: 1,
    pattern: Digit
  },
  expression: {
    kind: ExpressionKind.Native,
    fn: ({ _ }) => _.join('')
  }
}
