import { Pattern, PatternKind } from '../../runtime/patterns/mod.ts'
import { ExpressionKind } from '../../runtime/expressions/mod.ts'

// NewLine
//   = '\n'
//   | '\r\n' -> '\n'
//   | '\r' -> '\n'

export const NewLine: Pattern = {
  kind: PatternKind.Or,
  patterns: [
    { kind: PatternKind.Equal, value: '\n' },
    {
      kind: PatternKind.Projection,
      pattern: {
        kind: PatternKind.Then,
        patterns: [
          { kind: PatternKind.Equal, value: '\r' },
          { kind: PatternKind.Equal, value: '\n' },
        ]
      },
      expression: {
        kind: ExpressionKind.Native,
        fn: () => '\n'
      }
    },
    {
      kind: PatternKind.Projection,
      pattern: {
        kind: PatternKind.Then,
        patterns: [
          { kind: PatternKind.Equal, value: '\r' },
        ]
      },
      expression: {
        kind: ExpressionKind.Native,
        fn: () => '\n'
      }
    },
  ]
}
