import { Pattern, PatternKind } from '../../runtime/patterns/mod.ts'
import { ExpressionKind } from '../../runtime/expressions/mod.ts'
import { LangPatternKind } from './lang.pattern.ts'

export const MustPattern: Pattern = {
  kind: PatternKind.Rule,
  pattern: {
    kind: PatternKind.Or,
    patterns: [
      {
        kind: PatternKind.Projection,
        pattern: {
          kind: PatternKind.Then,
          patterns: [
            {
              kind: PatternKind.Variable,
              name: 'pattern',
              pattern: {
                kind: PatternKind.Reference,
                name: LangPatternKind.NotPattern
              }
            },
            {
              kind: PatternKind.Object,
              keys: {
                type: { kind: PatternKind.Equal, value: 'Token' },
                value: { kind: PatternKind.Equal, value: '!' },
              }
            },
          ]
        },
        expression:{
          kind: ExpressionKind.Native,
          fn: ({ pattern }) => ({
            kind: LangPatternKind.MustPattern,
            pattern
          })
        }
      },
      {
        kind: PatternKind.Reference,
        name: LangPatternKind.NotPattern
      }
    ]
  }
}
