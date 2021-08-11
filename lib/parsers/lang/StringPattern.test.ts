import { tests } from '../../test.ts'
import { TestLang } from './Lang.test.ts'
import { LangPatternKind } from './lang.pattern.ts'

tests('parsers.lang.stringpattern', () => [
  {
    id: 'STRINGPATTERN00',
    description: 'Can parse strings',
    pattern: () => TestLang,
    input: "'abc'",
    value: {
      kind: LangPatternKind.StringPattern,
      value: 'abc'
    }
  }
])
