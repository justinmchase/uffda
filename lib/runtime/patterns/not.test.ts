import { tests } from '../../test.ts'
import { PatternKind } from './pattern.kind.ts'

tests('patterns.not', () => [
  {
    id: 'NOT00',
    description: '!ok',
    pattern: () => ({ kind: PatternKind.Not, pattern: { kind: PatternKind.Ok } }),
    input: [],
    matched: false
  },
  {
    id: 'NOT00',
    description: '!fail',
    pattern: () => ({ kind: PatternKind.Not, pattern: { kind: PatternKind.Fail }}),
    input: [],
  },
  {
    id: 'NOT00',
    description: '!!ok',
    pattern: () => ({
      kind: PatternKind.Not,
      pattern: {
        kind: PatternKind.Not,
        pattern: { kind: PatternKind.Ok }
      }
    }),
    input: [],
  },
  {
    id: 'NOT00',
    description: '!fail consumes no input',
    pattern: () => ({ kind: PatternKind.Not, pattern: { kind: PatternKind.Fail }}),
    input: 'a',
    done: false,
  }
])
