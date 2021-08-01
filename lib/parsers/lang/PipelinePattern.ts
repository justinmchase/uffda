import { or, projection, variable, then, object, rule, equal } from '../../patterns/mod.ts'
import { OrPattern } from './OrPattern.ts'

export const PipelinePattern = rule({
  name: 'PipelinePattern',
  pattern: or({
    patterns: [
      projection({
        pattern: then({
          patterns: [
            variable({
              name: 'l',
              pattern: s => PipelinePattern(s),
            }),
            object({
              keys: {
                type: equal({ value: 'Token' }),
                value: equal({ value: '>' })
              }
            }),
            variable({
              name: 'r',
              pattern: OrPattern
            })
          ]
        }),
        expr: ({ l, r }) => ({
          type: 'PipelinePattern',
          left: l,
          right: r
        }),
      }),
      OrPattern
    ]
  })
})
