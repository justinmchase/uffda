import { Pattern, PatternKind } from '../../runtime/patterns/mod.ts'
import { ExpressionKind } from '../../runtime/expressions/mod.ts'

export const ZeroOrMorePattern: Pattern = {
  kind: PatternKind.Rule,
  pattern: {
    kind: PatternKind.Projection,
    pattern: {
      kind: PatternKind.Object,
      keys: {
        type: { kind: PatternKind.Equal, value: 'ZeroOrMorePattern' },
        pattern: {
          kind: PatternKind.Variable,
          name: 'pattern',
          pattern: { kind: PatternKind.Reference, name: 'TerminalPattern' }
        }
      }
    },
    expression: {
      kind: ExpressionKind.Native,
      fn: ({ pattern }) => ({
        kind: PatternKind.Slice,
        min: 0,
        pattern
      })
    }
  }
}
