import { tests } from '../../test.ts'
import { TestLang } from './Lang.test.ts'
import { LangPatternKind } from './lang.pattern.ts'

tests('parsers.lang.oneormore', () => [
  {
    id: "ONEORMORE00",
    description: 'parse one or more reference',
    pattern: () => TestLang,
    input: 'x+',
    value: {
      kind: LangPatternKind.OneOrMorePattern,
      pattern: {
        kind: LangPatternKind.ReferencePattern,
        name: 'x'
      }
    }
  }
])