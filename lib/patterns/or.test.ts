import { tests } from '../pattern.test.ts'
import { any } from './any.ts'
import { equal } from './equal.ts'
import { or } from './or.ts'

tests('patterns.or', () => [
  {
    id: 'OR00',
    description:'requires at least one pattern',
    pattern: () => or({ patterns: [] }),
    throws: true
  },
  {
    id: 'OR01',
    description: 'matches with a single pattern',
    pattern: () => or({
      patterns: [
        any()
      ]
    }),
    input: 'a',
    value: 'a',
  },
  {
    id: 'OR02',
    description: 'matches second pattern',
    pattern: () => or({
      patterns: [
        equal({ value: 1 }),
        equal({ value: 2 })
      ]
    }),
    input: [2],
    value: 2
  },
  {
    id: 'OR03',
    description: 'fails if no pattern matches',
    pattern: () => or({
      patterns: [
        equal({ value: 1 }),
        equal({ value: 2 })
      ]
    }),
    input: [3],
    matched: false,
    done: false,
  },
  {
    id: 'OR04',
    description: 'consumes only a single input',
    pattern: () => or({
      patterns: [
        equal({ value: 1 })
      ]
    }),
    input: [1, 2],
    value: 1,
    done: false
  }
])
