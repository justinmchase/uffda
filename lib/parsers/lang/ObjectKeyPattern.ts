import { Pattern, PatternKind } from '../../runtime/patterns/mod.ts'

export const ObjectKeyPattern: Pattern = {
  kind: PatternKind.Rule,
  pattern: {
    kind: PatternKind.Or,
    patterns: [
      { kind: PatternKind.Reference, name: 'ObjectKeyVariableWithPattern' },
      { kind: PatternKind.Reference, name: 'ObjectKeyVariablePattern' },
      { kind: PatternKind.Reference, name: 'ObjectKeyWithPattern' },
      { kind: PatternKind.Reference, name: 'ObjectKeyReferencePattern' },
    ]
  }
}
