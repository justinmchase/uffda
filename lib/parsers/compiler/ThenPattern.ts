import { Pattern, PatternKind } from '../../runtime/patterns/mod.ts'
import { ExpressionKind } from '../../runtime/expressions/mod.ts'

export const ThenPattern: Pattern = {
  kind: PatternKind.Rule,
  pattern: {
    kind: PatternKind.Or,
    patterns: [
      {
        kind: PatternKind.Projection,
        pattern: {
          kind: PatternKind.Object,
          keys: {
            kind: { kind: PatternKind.Equal, value: 'ThenPattern' },
            left: {
              kind: PatternKind.Variable,
              name: 'left',
              pattern: { kind: PatternKind.Reference, name: 'ThenPattern' }
            },
            right: {
              kind: PatternKind.Variable,
              name: 'right',
              pattern: { kind: PatternKind.Reference, name: 'VariablePattern' }
            }
          }
        },
        expression: {
          kind: ExpressionKind.Native,
          fn: ({ left, right }) => ({
            kind: PatternKind.Then,
            patterns: [left, right]
          })
        }
      },
      { kind: PatternKind.Reference, name: 'VariablePattern' }
    ]
  }
}
