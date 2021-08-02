import { tests } from '../pattern.test.ts'
import { and } from './and.ts'
import { any } from './any.ts'
import { regexp } from './regexp.ts'
import { then } from './then.ts'

tests('patterns.and', () => [
  {
    id: 'AND00',
    description: 'and pattern matches with single pattern',
    pattern: () => and({
      patterns: [
        any()
      ]
    }),
    input: 'a',
    value: 'a',
  },  
  {
    id: "AND01",
    description: "pattern matches with two patterns",
    pattern: () => and({
      patterns: [
        any(),
        any(),
      ]
    }),
    input: 'a',
    value: 'a'
  },
  {
    id: "AND02",
    description: "and pattern only consumes a single input",
    pattern: () => then({
      patterns: [
        and({
          patterns: [
            any(),
            any(),
          ]
        }),
        any()
      ]
    }),
    input: 'ab',
    value: ['a', 'b']
  },
  {
    id: "AND03",
    description: "fails if first pattern fails",
    pattern: () => and({
      patterns: [
        regexp({ pattern: /b/ }),
        regexp({ pattern: /a/ }),
      ]
    }),
    input: 'a',
    matched: false,
    done: false
  },
  {
    id: "AND04",
    description: "fails if second pattern fails",
    pattern: () => and({
      patterns: [
        regexp({ pattern: /a/ }),
        regexp({ pattern: /b/ }),
      ]
    }),
    input: 'a',
    matched: false,
    done: false,
  }
])
