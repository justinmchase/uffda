import { tests } from '../../test.ts'
import { PatternKind } from './pattern.kind.ts'

tests('patterns.number', () => [
  {
    id: "NUMBER00",
    description: 'reads a number successfully',
    pattern: () => ({ kind: PatternKind.Number }),
    input: [7],
    value: 7,
  },
  {
    id: "NUMBER01",
    description: 'does not read a non-number',
    pattern: () => ({ kind: PatternKind.Number }),
    input: ['a'],
    matched: false,
    done: false
  },
])
