import { any, regexp, projection, or, then, object, rule, variable } from '../../patterns'
import { ThenPattern } from './ThenPattern'

export const ProjectionPattern = rule({
  name: 'ProjectionPattern',
  pattern: or({
    patterns: [
      projection({
        pattern: then({
          patterns: [
            variable({
              name: 'p',
              pattern: s => ThenPattern(s)
            }),
            object({
              keys: {
                type: regexp({ pattern: /Token/ }),
                value: regexp({ pattern: /-/ })
              }
            }),
            object({
              keys: {
                type: regexp({ pattern: /Token/ }),
                value: regexp({ pattern: />/ })
              }
            }),
            object({
              keys: {
                type: regexp({ pattern: /Identifier/ }),
                value: variable({
                  name: 'e',
                  pattern: any
                })
              }
            })
          ]
        }),
        expr: ({ p, e }, projections) => (console.log('ProjectionPattern'), {
          type: 'ProjectionPattern',
          pattern: p,
          expression: projections[e]
        })
      }),
      s => ThenPattern(s)
    ],
  })
})
