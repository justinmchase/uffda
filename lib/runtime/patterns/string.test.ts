import { tests } from '../../test.ts'
import { PatternKind } from './pattern.kind.ts'

tests('patterns.string', () => [
  {
    id: "STRING00",
    description: 'reads a string successfully',
    pattern: () => ({ kind: PatternKind.String }),
    input: ['a'],
    value: 'a',
  },
  {
    id: "STRING01",
    description: 'does not read a non-string',
    pattern: () => ({ kind: PatternKind.String }),
    input: [7],
    matched: false,
    done: false
  },
])
