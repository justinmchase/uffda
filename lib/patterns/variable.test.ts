import { tests } from '../pattern.test.ts'
import { any } from './any.ts'
import { array } from './array.ts'
import { object } from './object.ts'
import { projection } from './projection.ts'
import { then } from './then.ts'
import { variable } from './variable.ts'

tests('patterns.variable', () => [
  {
    id: 'VARIABLE00',
    description: 'should be available in projection of same scope',
    // P = x:any -> x + 11
    pattern: () => projection({
      pattern: variable({
        name: 'x',
        pattern: any()
      }),
      expr: ({ x }: { x: number }) => x + 11
    }),
    input: [7],
    value: 18,
  },
  {
    id: 'VARIABLE01',
    description: 'multiple variables should be available in projection of same scope',
    // P = x:any y:any -> x + y
    pattern: () => projection({
      pattern: then({
        patterns: [
          variable({
            name: 'x',
            pattern: any()
          }),
          variable({
            name: 'y',
            pattern: any()
          }),
        ]
      }),
      expr: ({ x, y }: { x: number, y: number }) => x + y
    }),
    input: [7, 11],
    value: 18
  },
  {
    id: 'VARIABLE02',
    description: 'variables on object keys should be available',
    // P = { x:X, y:Y } -> x + y
    pattern: () => projection({
      pattern: object({
        keys: {
          X: variable({
            name: 'x',
            pattern: any(),
          }),
          Y: variable({
            name: 'y',
            pattern: any()
          })
        }
      }),
      expr: ({ x, y }: { x: number, y: number }) => x + y
    }),
    input: [{ X: 7, Y: 11 }],
    value: 18,
  },
  {
    id: 'VARIABLE03',
    description: 'variables in object key pattern should be available',
    // P = { X = [,x], Y = [,y] } -> x + y
    pattern: () => projection({
      pattern: object({
        keys: {
          X: array({
            pattern: then({
              patterns: [
                any(),
                variable({
                  name: 'x',
                  pattern: any()
                }),
              ]
            })
          }),
          Y: array({
            pattern: then({
              patterns: [
                any(),
                variable({
                  name: 'y',
                  pattern: any()
                }),
              ]
            })
          })
        }
      }),
      expr: ({ x, y }: { x: number, y: number }) => x + y
    }),
    input: [{ X: [6, 7], Y: [10, 11] }],
    value: 18,
  }
  // todo: variable name colision should probably be an error
])
