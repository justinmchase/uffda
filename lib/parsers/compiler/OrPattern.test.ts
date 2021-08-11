import { tests } from '../../test.ts'
import { Meta } from '../meta.ts'
import { PatternKind } from '../../runtime/patterns/mod.ts'

tests('parsers.compiler.orpattern', () => [
  {
    id: 'ORPATTERN00',
    description: 'a | b',
    pattern: () => Meta,
    input: 'a | b',
    value: {
      kind: PatternKind.Or,
      patterns: [
        {
          kind: PatternKind.Reference,
          name: 'a'
        },
        {
          kind: PatternKind.Reference,
          name: 'b'
        }
      ]
    }
  }
])
