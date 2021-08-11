import { tests } from '../../test.ts'
import { Meta } from '../meta.ts'
import { PatternKind } from '../../runtime/patterns/mod.ts'

tests('parsers.compiler.objectpattern', () => [
  {
    id: 'OBJECTPATTERN00',
    description: 'parses ObjectPattern into object pattern',
    pattern: () => Meta,
    input: '{ x = ok }',
    value: {
      kind: PatternKind.Object,
      keys: {
        x: { kind: PatternKind.Ok }
      }
    }
  }
])
