import { Pattern, PatternKind } from '../../runtime/patterns/mod.ts'
import { ExpressionKind } from '../../runtime/expressions/mod.ts'

export const PatternDeclaration: Pattern = {
  kind: PatternKind.Rule,
  pattern: {
    kind: PatternKind.Projection,
    pattern: {
      kind: PatternKind.Object,
      keys: {
        kind: { kind: PatternKind.Equal, value: 'PatternDeclaration' },
        name: {
          kind: PatternKind.Variable,
          name: 'name',
          pattern: { kind: PatternKind.String }
        },
        pattern: {
          kind: PatternKind.Variable,
          name: 'pattern',
          pattern: { kind: PatternKind.Reference, name: 'PatternExpression' }
        }
      }
    },
    expression: {
      kind: ExpressionKind.Native,
      fn: ({ name, pattern }) => ({
        [name]: {
          kind: PatternKind.Rule,
          pattern
        }
      })
    }
  }
}
