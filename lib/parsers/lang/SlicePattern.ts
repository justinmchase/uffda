import { Pattern, PatternKind } from '../../runtime/patterns/mod.ts'

export const SlicePattern: Pattern = {
  kind: PatternKind.Rule,
  pattern: {
    kind: PatternKind.Or,
    patterns: [
      { kind: PatternKind.Reference, name: 'OneOrMorePattern' },
      { kind: PatternKind.Reference, name: 'ZeroOrMorePattern' },
      { kind: PatternKind.Reference, name: 'ZeroOrOnePattern' },
      { kind: PatternKind.Reference, name: 'TerminalPattern' },
    ]
  }
}
