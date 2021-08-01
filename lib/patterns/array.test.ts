import { tests } from './pattern.test.ts'
import { then } from './then.ts'
import { any } from './any.ts'
import { array } from './array.ts'
import { not } from './not.ts'
import { slice } from './slice.ts'

tests('patterns.array', () => [
  {
    id: 'ARRAY00',
    description: 'matches explicit empty array',
    pattern: () => array({
      pattern: not({ pattern: any() })
    }),
    input: [[]]
  },
  {
    id: 'ARRAY01',
    description: 'matches array with 1 item',
    pattern: () => array({
      pattern: any()
    }),
    input: [['a']],
    value: 'a'
  },
  {
    id: 'ARRAY02',
    description: 'matches array with 2 item',
    pattern: () => array({
      pattern: then({
        patterns: [
          any(),
          any(),
        ]
      })
    }),
    input: [['a', 'b']],
    value: ['a', 'b']
  },
  {
    id: 'ARRAY03',
    description: 'slicing an array with 2 item matches all items',
    pattern: () => array({
      pattern: slice({
        pattern: any()
      })
    }),
    input: [['a', 'b']],
    value: ['a', 'b']
  },
  {
    id: 'ARRAY04',
    description: 'fails if all items in array are not matched',
    pattern: () => array({
      pattern: any()
    }),
    input: [['a', 'b']],
    value: 'a',
    matched: false,
    done: false,
  },
  {
    id: 'ARRAY05',
    description: 'matches array with an array',
    pattern: () => array({
      pattern: array({
        pattern: any()
      })
    }),
    input: [[['a']]],
    value: 'a'
  },
  {
    id: 'ARRAY06',
    description: 'match outside of array fails',
    pattern: () => array({
      pattern: then({
        patterns: [
          any(),
          any(),
        ]
      })
    }),
    input: [['a'], 'b'],
    matched: false,
    done: false
  }
])
