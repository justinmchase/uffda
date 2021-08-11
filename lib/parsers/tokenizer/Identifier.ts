import { Pattern, PatternKind } from '../../runtime/patterns/mod.ts'
import { ExpressionKind } from '../../runtime/expressions/mod.ts'
import { Letter } from './Letter.ts'
import { Digit } from './Digit.ts'

// Identifier = Letter+ (Digit | Character)*
export const Identifier: Pattern = {
  kind: PatternKind.Rule,
  pattern: {
    kind: PatternKind.Projection,
    pattern: {
      kind: PatternKind.Then,
      patterns: [
        {
          kind: PatternKind.Variable,
          name: 'a',
          pattern: {
            kind: PatternKind.Slice,
            min: 1,
            pattern: Letter,
          }
        },
        {
          kind: PatternKind.Variable,
          name: 'b',
          pattern: {
            kind: PatternKind.Slice,
            pattern: {
              kind: PatternKind.Or,
              patterns: [
                Digit,
                Letter,
              ]
            }
          }
        }
      ]
    },
    expression: {
      kind: ExpressionKind.Native,
      fn: ({ a, b }) => a.join('') + b.join('')
    }
  }
}
