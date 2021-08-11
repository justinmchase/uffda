import { Pattern, PatternKind } from '../../runtime/patterns/mod.ts'
import { ExpressionKind } from '../../runtime/expressions/mod.ts'

export const OneOrMorePattern: Pattern = {
  kind: PatternKind.Rule,
  pattern: {
    kind: PatternKind.Projection,
    pattern: {
      kind: PatternKind.Object,
      keys: {
        kind: { kind: PatternKind.Equal, value: 'OneOrMorePattern' },
        pattern: {
          kind: PatternKind.Variable,
          name: 'pattern',
          pattern: { kind: PatternKind.Reference, name: 'TerminalPattern' },
        }
      }
    },
    expression: {
      kind: ExpressionKind.Native,
      fn: ({ pattern }: { pattern: Pattern }) => ({
        kind: PatternKind.Slice,
        min: 1,
        pattern
      })
    }
  }
}
