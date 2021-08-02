import { tests } from '../pattern.test.ts'
import { Scope } from '../scope.ts'
import { any } from './any.ts'
import { projection } from './projection.ts'

tests('patterns.projection', () => {
  const $0 = () => 11
  return [
    {
      id: 'PROJECTION00',
      description: 'calls expression on match',
      pattern: () => projection({
        pattern: any(),
        expr: () => 11
      }),
      input: [7],
      value: 11,
    },
    {
      id: 'PROJECTION01',
      description: 'provides variables as an argument',
      pattern: () => projection({
        pattern: any(),
        expr: ({ v0 }) => v0
      }),
      input: Scope.From([7]).addVariables({ v0: 11 }),
      value: 11,
    },
    {
      id: 'PROJECTION02',
      description: 'provides projections as an argument',
      pattern: () => projection<unknown, { $0: () => number }>({
        pattern: any(),
        expr: ({ $0 }) => $0()
      }),
      input: Scope.From([7]).addVariables({ $0 }),
      value: 11
    }
  ]
})
