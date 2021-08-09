import { regexp, string, projection, variable, object, rule, then, or } from '../../patterns/mod.ts'
import { SlicePattern } from './SlicePattern.ts'

export const VariablePattern = rule({
  name: 'VariablePattern',
  pattern: or({
    patterns: [
      projection({
        pattern: then({
          patterns: [
            object({
              keys: {
                type: regexp({ pattern: /Identifier/ }),
                value: variable({
                  name: 'name',
                  pattern: string()
                })
              }
            }),
            object({
              keys: {
                type: regexp({ pattern: /Token/ }),
                value: regexp({ pattern: /:/ }),
              }
            }),
            variable({
              name: 'value',
              pattern: s => SlicePattern(s)
            })
          ]
        }),
        expr: ({ name, value }) => ({
          type: 'VariablePattern',
          name,
          value
        })
      }),
      s => SlicePattern(s)
    ]
  })
})
