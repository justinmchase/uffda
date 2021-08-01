import { any, regexp, projection, or, then, object, rule, variable } from '../../patterns/mod.ts'
import { ThenPattern } from './ThenPattern.ts'
import { SpecialReferencePattern } from './SpecialReferencePattern.ts'

export const ProjectionPattern = rule({
  name: 'ProjectionPattern',
  pattern: or({
    patterns: [
      projection({
        pattern: then({
          patterns: [
            variable({
              name: 'pattern',
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
            variable({
              name: 'expression',
              pattern: SpecialReferencePattern
            })
          ]
        }),
        expr: ({ pattern, expression }) => ({
          type: 'ProjectionPattern',
          pattern,
          expression,
        })
      }),
      s => ThenPattern(s)
    ],
  })
})
