import { tests } from '../../test.ts'
import { Meta } from '../meta.ts'
import { PatternKind } from '../../runtime/patterns/mod.ts'
import { ExpressionKind } from '../../runtime/expressions/mod.ts'

tests('parsers.compiler.specialreferencepattern', () => [
  {
    id: 'SPECIALREFERENCEPATTERN00',
    description: 'a -> $0',
    pattern: () => Meta,
    input: 'a -> $0',
    value: {
      kind: PatternKind.Projection,
      pattern: {
        kind: PatternKind.Reference,
        name: 'a'
      },
      expression: {
        kind: ExpressionKind.SpecialReference,
        name: '$0'
      }
    }
  }
])
