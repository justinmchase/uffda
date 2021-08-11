import { Pattern, PatternKind } from '../../runtime/patterns/mod.ts'
import { ExpressionKind } from '../../runtime/expressions/mod.ts'

export const PipelinePattern: Pattern = {
  kind: PatternKind.Block,
  variables: {
    PipelinePattern: {
      kind: PatternKind.Rule,
      pattern: {
        kind: PatternKind.Or,
        patterns: [
          {
            kind: PatternKind.Projection,
            pattern: {
              kind: PatternKind.Object,
              keys: {
                kind: { kind: PatternKind.Equal, value: 'PipelinePattern' },
                left: {
                  kind: PatternKind.Variable,
                  name: 'left',
                  pattern: { kind: PatternKind.Reference, name: 'PipelinePattern' }
                },
                right: {
                  kind: PatternKind.Variable,
                  name: 'right',
                  pattern: { kind: PatternKind.Reference, name: 'OrPattern' }
                }
              }
            },
            expression: {
              kind: ExpressionKind.Native,
              fn: ({ left, right }) => ({
                kind: PatternKind.Pipeline,
                steps: [left, right]
              })
            }
          },
          { kind: PatternKind.Reference, name: 'OrPattern' }
        ]
      }
    }
  }
}
