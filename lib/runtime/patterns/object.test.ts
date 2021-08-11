import { tests } from '../../test.ts'
import { PatternKind } from './pattern.kind.ts'

tests('patterns.object', () => [
  {
    id: 'OBJECT00',
    description: 'matches an object without keys',
    pattern: () => ({
      kind: PatternKind.Object,
      keys: {}
    }),
    input: [{}],
    value: {},
  },
  {
    id: 'OBJECT01',
    description: 'matches an object with extra keys',
    pattern: () => ({
      kind: PatternKind.Object,
      keys: {}
    }),
    input: [{ x: 'a' }],
    value: { x: 'a' },
  },
  {
    id: 'OBJECT02',
    description: 'matches an object and key',
    pattern: () => ({
      kind: PatternKind.Object,
      keys: {
        x: { kind: PatternKind.String }
      }
    }),
    input: [{ x: 'a' }],
    value: { x: 'a' },
  },
  {
    id: 'OBJECT03',
    description: 'fails to match an object missing a key',
    pattern: () => ({
      kind: PatternKind.Object,
      keys: {
        x: { kind: PatternKind.String }
      }
    }),
    input: [{}],
    matched: false,
    done: false
  },
  {
    id: 'OBJECT04',
    description: 'matches if all keys match',
    pattern: () => ({
      kind: PatternKind.Object,
      keys: {
        type: {
          kind: PatternKind.Equal,
          value: 'x'
        },
        value: {
          kind: PatternKind.Equal,
          value: 'y'
        }
      }
    }),
    input: [{ type: 'x', value: 'y' }],
    value: { type: 'x', value: 'y' },
  }
])
