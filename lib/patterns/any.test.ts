import { tests } from './pattern.test.ts'
import { any } from './any.ts'

tests('patterns.any', () => [
  {
    id: "ANY00",
    description: 'reads string successfully',
    pattern: () => any(),
    input: 'a',
    value: 'a',
  },
  {
    id: "ANY01",
    description: 'reads array successfully',
    pattern: () => any(),
    input: ['a'],
    value: 'a',
  },
  {
    id: "ANY02",
    description: 'fails to read empty stream',
    pattern: () => any(),
    input: '',
    matched: false,
  },
  {
    id: "ANY03",
    description: 'reads example 1 input',
    pattern: () => any(),
    input: 'ab',
    value: 'a',
    done: false,
  }
])
