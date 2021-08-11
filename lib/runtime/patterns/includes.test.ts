import { tests } from '../../test.ts'
import { PatternKind } from './pattern.kind.ts'

tests('patterns.includes', () => [
  {
    id: 'INCLUDES00',
    description: 'can match single included value',
    pattern: () => ({
      kind: PatternKind.Includes,
      values: ['x']
    }),
    input: 'x',
    value: 'x',
  },
  {
    id: 'INCLUDES01',
    description: 'can match single included value in set of values',
    pattern: () => ({
      kind: PatternKind.Includes,
      values: ['x', 'y', 'z']
    }),
    input: 'y',
    value: 'y',
  },
  {
    id: 'INCLUDES02',
    description: 'fails to match if not in set of values',
    pattern: () => ({
      kind: PatternKind.Includes,
      values: ['x', 'y', 'z']
    }),
    input: 'a',
    matched: false,
    done: false
  }
])
