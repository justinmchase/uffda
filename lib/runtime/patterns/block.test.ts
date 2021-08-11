import { assert } from '../../../deps/std.ts'
import { tests } from '../../test.ts'
import { ExpressionKind } from '../expressions/mod.ts'
import { PatternKind } from './pattern.kind.ts'

tests('patterns.block', () => [
  {
    id: 'BLOCK00',
    description: 'can run main pattern',
    pattern: () => ({
      kind: PatternKind.Block,
      variables: {
        Main: ({ kind: PatternKind.Equal, value: 'a' })
      }
    }),
    input: 'a',
    value: 'a',
  },
  {
    id: 'BLOCK01',
    description: 'defaults to last pattern',
    pattern: () => ({
      kind: PatternKind.Block,
      variables: {
        A: { kind: PatternKind.Equal, value: 'a' },
        B: { kind: PatternKind.Equal, value: 'b' },
      }
    }),
    input: 'b',
    value: 'b',
  },
  {
    id: 'BLOCK02',
    description: 'empty block is ok',
    pattern: () => ({kind: PatternKind.Block, variables: {}}),
    input: 'a',
    done: false,
  },
  {
    id: 'BLOCK03',
    description: 'block values are available as variables',
    pattern: () => ({
      kind: PatternKind.Block,
      variables: {
        A: { kind: PatternKind.Any },
        Main: {
          kind: PatternKind.Projection,
          pattern: { kind: PatternKind.Any },
          expression: {
            kind: ExpressionKind.Native,
            fn: ({ A }) => (assert(A), 7)
          }
        }
      }
    }),
    input: 'x',
    value: 7
  },
  {
    id: 'BLOCK04',
    description: 'higher block values are available as variables',
    pattern: () => ({
      kind: PatternKind.Block,
      variables: {
        A: { kind: PatternKind.Any },
        Main: {
          kind: PatternKind.Block,
          variables: {
            B: { kind: PatternKind.Any },
            Main: {
              kind: PatternKind.Projection,
              pattern: { kind: PatternKind.Any },
              expression: {
                kind: ExpressionKind.Native,
                fn: ({ A, B }) => (assert(A), assert(B), 7)
              }
            }
          }
        }
      }
    }),
    input: 'x',
    value: 7,
  },
  {
    id: 'BLOCK05',
    description: 'block values are available in rule as variables',
    pattern: () => ({
      kind: PatternKind.Block,
      variables: {
        A: { kind: PatternKind.Any },
        Main: {
          kind: PatternKind.Rule,
          pattern: {
            kind: PatternKind.Projection,
            pattern: { kind: PatternKind.Any },
            expression: {
              kind: ExpressionKind.Native,
              fn: ({ A }) => (assert(A), 7)
            }
          }
        }
      }
    }),
    input: 'x',
    value: 7,
  }
])
