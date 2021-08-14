import { tests } from '../../test.ts'
import { PatternKind } from './pattern.kind.ts'

tests('patterns.must', () => [
  {
    id: 'MUST00',
    description: 'ok!',
    pattern: () => ({
      kind: PatternKind.Must,
      pattern: { kind: PatternKind.Ok }
    }),
    input: []
  },
  {
    id: 'MUST01',
    description: 'fail!',
    pattern: () => ({
      kind: PatternKind.Must,
      pattern: { kind: PatternKind.Fail }
    }),
    input: [],
    matched: false,
    errors: [
      { start: '-1', end: '-1' }
    ]
  },
  {
    id: 'MUST01',
    description: "'a'!",
    pattern: () => ({
      kind: PatternKind.Must,
      pattern: { kind: PatternKind.Equal, value: 'a' }
    }),
    input: 'a',
    value: 'a',
  },
  {
    id: 'MUST01',
    description: "'a'!",
    pattern: () => ({
      kind: PatternKind.Must,
      pattern: { kind: PatternKind.Equal, value: 'a' }
    }),
    input: 'b',
    matched: false,
    done: false,
    errors: [
      { start: '-1', end: '-1' }
    ]
  },
])