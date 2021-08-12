import { Pattern, PatternKind } from '../../runtime/patterns/mod.ts'
import { ExpressionKind } from '../../runtime/expressions/mod.ts'

export const StringPattern: Pattern = {
  kind: PatternKind.Rule,
  pattern: {
    kind: PatternKind.Projection,
    pattern: {
      kind: PatternKind.Object,
      keys: {
        kind: { kind: PatternKind.Equal, value: 'StringPattern' },
        value: {
          kind: PatternKind.Variable,
          name: 'value',
          pattern: { kind: PatternKind.String }
        }
      }
    },
    expression: {
      kind: ExpressionKind.Native,
      fn: ({ value, _ }) => ({
        kind: PatternKind.Equal,
        value
      })
    }
  }
}
