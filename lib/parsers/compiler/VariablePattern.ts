import { Pattern, PatternKind } from '../../runtime/patterns/mod.ts'
import { ExpressionKind } from '../../runtime/expressions/mod.ts'
import { LangPatternKind } from '../lang/lang.pattern.ts'

export const VariablePattern: Pattern = {
  kind: PatternKind.Rule,
  pattern: {
    kind: PatternKind.Or,
    patterns: [
      {
        kind: PatternKind.Projection,
        pattern: {
          kind: PatternKind.Object,
          keys: {
            kind: { kind: PatternKind.Equal, value: LangPatternKind.VariablePattern },
            name: {
              kind: PatternKind.Variable,
              name: 'name',
              pattern: { kind: PatternKind.String }
            },
            pattern: {
              kind: PatternKind.Variable,
              name: 'pattern',
              pattern: { kind: PatternKind.Reference, name: 'SlicePattern' }
            }
          }
        },
        expression: {
          kind: ExpressionKind.Native,
          fn: ({ name, pattern }) => ({
            kind: PatternKind.Variable,
            name,
            pattern
          })
        }
      },
      { kind: PatternKind.Reference, name: 'SlicePattern' }
    ]
  }
}
