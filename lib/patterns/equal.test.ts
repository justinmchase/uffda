import { tests } from '../pattern.test.ts'
import { equal } from './equal.ts'

tests('patterns.equal', () => [
  {
    id: 'EQUAL00',
    description: 'matches exact string',
    pattern: () => equal({
      value: 'a'
    }),
    input: 'a',
    value: 'a',
  },
  {
    id: 'EQUAL01',
    description: 'matches exact number',
    pattern: () => equal({
      value: 7
    }),
    input: [7],
    value: 7,
  },
  {
    id: 'EQUAL02',
    description: 'fails to match wrong number',
    pattern: () => equal({
      value: 7
    }),
    input: [11],
    matched: false,
    done: false
  }
])
