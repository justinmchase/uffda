import { tests } from '../../test.ts'
import { Meta } from '../meta.ts'
import { PatternKind } from '../../runtime/patterns/mod.ts'

tests('parsers.compiler.variablepattern', () => [
  {
    id: 'ZEROORMORE00',
    description: "x*",
    pattern: () => Meta,
    input: "x*",
    value: {
      kind: PatternKind.Slice,
      min: 0,
      pattern: {
        kind: PatternKind.Reference,
        name: 'x'
      }
    }
  }
])
