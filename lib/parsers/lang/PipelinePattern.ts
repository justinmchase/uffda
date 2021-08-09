import { or, projection, variable, then, object, rule, equal } from '../../patterns/mod.ts'
import { OrPattern } from './OrPattern.ts'

// PipelinePattern
//   = l:PipelinePattern { type: 'Token', value: '>' } r:OrPattern
//   | OrPattern
//
// e.g. 
// x > y > z
//
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
              pattern: s => OrPattern(s)
            })
          ]
        }),
        expr: ({ l, r }) => ({
          type: 'PipelinePattern',
          left: l,
          right: r
        }),
      }),
      s => OrPattern(s)
    ]
  })
})
