import { tests } from '../pattern.test.ts'
import { any } from './any.ts'
import { includes } from './includes.ts'
import { object } from './object.ts'

tests('patterns.object', () => [
  {
    id: 'OBJECT00',
    description: 'matches an object without keys',
    pattern: () => object({
      keys: {}
    }),
    input: [{}],
    value: {},
  },
  {
    id: 'OBJECT01',
    description: 'matches an object with extra keys',
    pattern: () => object({
      keys: {}
    }),
    input: [{ x: 'a' }],
    value: { x: 'a' },
  },
  {
    id: 'OBJECT02',
    description: 'matches an object and key',
    pattern: () => object({
      keys: {
        x: any()
      }
    }),
    input: [{ x: 'a' }],
    value: { x: 'a' },
  },
  {
    id: 'OBJECT03',
    description: 'fails to match an object missing a key',
    pattern: () => object({
      keys: {
        x: any()
      }
    }),
    input: [{}],
    matched: false,
    done: false
  },
  {
    id: 'OBJECT04',
    description: 'matches if all keys match',
    pattern: () => object({
      keys: {
        type: includes({ values: ['x', 'y'] })
      }
    }),
    input: [{ type: 'x', value: 'y' }],
    value: { type: 'x', value: 'y' },
  }
])
