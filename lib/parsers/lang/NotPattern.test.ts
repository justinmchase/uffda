import { tests } from '../../test.ts'
import { TestLang } from './Lang.test.ts'
import { LangPatternKind } from './lang.pattern.ts'

tests('parsers.lang.not', () => [
  {
    id: 'NOT00',
    description: '^x',
    pattern: () => TestLang,
    input: '^x',
    value: {
      kind: LangPatternKind.NotPattern,
      pattern: {
        kind: LangPatternKind.ReferencePattern,
        name: 'x'
      }
    }
  }
])
