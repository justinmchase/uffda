import { tests } from '../pattern.test.ts'
import { any } from './any.ts'
import { ok } from './ok.ts'
import { regexp } from './regexp.ts'
import { slice } from './slice.ts'
import { then } from './then.ts'

tests('patterns.slice', () => [
  {
    id: 'SLICE00',
    description: 'zero or more matches ok without infinite looping',
    pattern: () => slice({
      pattern: ok()
    }),
    input: '',
    value: [],
  },
  {
    id: 'SLICE01',
    description: 'zero or more matches empty set',
    pattern: () => slice({}),
    input: '',
    value: [],
  },
  {
    id: 'SLICE02',
    description: 'zero or more matches a single element',
    pattern: () => slice({}),
    input: 'a',
    value: ['a'],
  },
  {
    id: 'SLICE03',
    description: 'zero or more matches multiple elements',
    pattern: () => slice({}),
    input: 'abc',
    value: ['a', 'b', 'c'],
  },
  {
    id: 'SLICE04',
    description: 'zero or more not matching is still a success',
    pattern: () => then({
      patterns: [
        slice({
          pattern: regexp({ pattern: /a/ })
        }),
        any()
      ]
    }),
    input: 'b',
    value: [[], 'b'],
  },
  {
    id: 'SLICE05',
    description: 'zero or more not matching at end is still a success',
    pattern: () => then({
      patterns: [
        any(),
        slice({
          pattern: regexp({ pattern: /a/ })
        }),
      ]
    }),
    input: 'a',
    value: ['a', []],
  },
  {
    id: 'SLICE06',
    description: 'one or more fails ok without infinite looping',
    pattern: () => slice({
      min: 1,
      pattern: ok()
    }),
    input: '',
    matched: false,
  },
  {
    id: 'SLICE07',
    description: 'one or more fails on empty set',
    pattern: () => slice({
      min: 1
    }),
    input: '',
    matched: false,
  },
  {
    id: 'SLICE08',
    description: 'one or more matches one item',
    pattern: () => slice({
      min: 1
    }),
    input: 'a',
    value: ['a'],
  },
  {
    id: 'SLICE09',
    description: 'one or more matches multiple items',
    pattern: () => slice({
      min: 1
    }),
    input: 'abc',
    value: ['a', 'b', 'c'],
  },
  {
    id: 'SLICE10',
    description: 'exact number matches exactly',
    pattern: () => slice({
      min: 3,
      max: 3
    }),
    input: 'abc',
    value: ['a', 'b', 'c'],
  },
  {
    id: 'SLICE11',
    description: 'exact number fails with not enough items',
    pattern: () => slice({
      min: 3,
      max: 3
    }),
    input: 'ab',
    matched: false,
    done: false,
  }
])
