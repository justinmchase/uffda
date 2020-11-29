import { any, equal, object, or, pipeline, projection, rule, variable } from '../../patterns'
import { OrPattern } from './OrPattern'

export const PipelinePattern = rule({
  name: 'PipelinePattern',
  pattern: or({
    patterns: [
      projection({
        pattern: object({
          keys: {
            type: equal({ value: 'PipelinePattern' }),
            left: variable({
              name: 'left',
              pattern: s => PipelinePattern(s)
            }),
            right: variable({
              name: 'right',
              pattern: OrPattern,
            })
          }
        }),
        expr: ({ left, right }) => (console.log('PIPELINE', left, right), pipeline({ steps: [left, right] }))
      }),
      OrPattern
    ]
  })
})
