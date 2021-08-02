import { tests } from '../pattern.test.ts'
import { any } from './any.ts'
import { pipeline } from './pipeline.ts'
import { projection } from './projection.ts'
import { slice } from './slice.ts'

tests('patterns.pipeline', () => [
  {
    id: 'PIPELINE0-',
    description: 'succeeds with single step',
    pattern: () => pipeline({
      steps: [
        any()
      ]
    }),
    input: 'a',
    value: 'a',
  },
  {
    id: 'PIPELINE01',
    description: 'succeeds with two steps',
    pattern: () => pipeline({
      steps: [
        projection({ pattern: any(), expr: () => 1 }),
        projection({ pattern: any(), expr: () => 2 }),
      ]
    }),
    input: [0],
    value: 2,
  },
  {
    id: 'PIPELINE02',
    description: 'output of previous step is input of next step',
    pattern: () => pipeline({
      steps: [
        projection({
          pattern: slice({ pattern: any() }),
          expr: ({ _ }: { _: number[] }) => _.map(n => n + 1)
        }),
        projection({
          pattern: slice({ pattern: any() }),
          expr: ({ _ }: { _: number[] }) => _.map(n => n * 2)
        })
      ]
    }),
    input: [1,2,3],
    value: [4,6,8]
  },
  {
    id: 'PIPELINE03',
    description: 'non-iterable output is wrapped in an iterable for next step',
    pattern: () => pipeline({
      steps: [
        any(),
        projection({
          pattern: slice({ pattern: any() }),
          expr: ({ _ }: { _: number[] }) => _.map(n => n * 2)
        })
      ]
    }),
    input: [11],
    value: [22],
  },
  {
    id: 'PIPELINE04',
    description: 'non-iterable output of final step is not wrapped in an iterable for final output',
    pattern: () => pipeline({
      steps: [
        projection({
          pattern: slice({ pattern: any() }),
          expr: ({ _ }: { _: number[] }) => _.reduce((i, n) => i + n, 0)
        })
      ]
    }),
    input: [1, 2, 3],
    value: 6
  },
  {
    id: 'PIPELINE0-',
    description: 'can have a pipeline as a step',
    pattern: () => pipeline({
      steps: [
        pipeline({
          steps: [
            slice({
              pattern: any()
            })
          ]
        }),
        projection({
          pattern: slice({ min: 3, max: 3, pattern: any() }),
          expr: ({ _ }: { _: number[] }) => _.join('-')
        })
      ]
    }),
    input: 'abc',
    value: 'a-b-c'
  }
])
