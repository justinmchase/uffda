import { tests } from '../../test.ts'
import { PatternKind } from './pattern.kind.ts'

tests('patterns.ok', () => [
  {
    id: 'OK00',
    description: 'ok matches empty input',
    pattern: () => ({ kind: PatternKind.Ok }),
    input: [],
  },
  {
    id: 'OK01',
    description: 'ok consumes no input',
    pattern: () => ({ kind: PatternKind.Ok }),
    input: 'a',
    done: false
  }
])