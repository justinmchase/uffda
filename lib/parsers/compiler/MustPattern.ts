import { Pattern, PatternKind } from '../../runtime/patterns/mod.ts'
import { ExpressionKind } from '../../runtime/expressions/mod.ts'

export const MustPattern: Pattern = {
  kind: PatternKind.Rule,
  pattern: {
    kind: PatternKind.Projection,
    pattern: {
      kind: PatternKind.Object,
      keys: {
        kind: { kind: PatternKind.Equal, value: 'MustPattern' },
        pattern: {
          kind: PatternKind.Variable,
          name: 'pattern',
          pattern: {
            kind: PatternKind.Reference,
            name: "PatternExpression"
          }
        }
      }
    },
    expression: {
      kind: ExpressionKind.Native,
      fn: ({ pattern }) => ({
        kind: PatternKind.Must,
        pattern
      })
    }
  }
}
