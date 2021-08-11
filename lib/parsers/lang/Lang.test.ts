import { Pattern, PatternKind } from '../../runtime/patterns/mod.ts'
import { Basic, Lang } from '../mod.ts'

export const TestLang: Pattern = {
  kind: PatternKind.Block,
  variables: {
    Basic,
    Lang,
    Main: {
      kind: PatternKind.Pipeline,
      steps: [
        { kind: PatternKind.Reference, name: 'Basic' },
        { kind: PatternKind.Reference, name: 'Lang' },
      ]
    }
  }
}
