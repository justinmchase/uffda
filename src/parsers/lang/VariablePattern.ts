import { any, regexp, projection, variable, object, rule, then, or } from '../../patterns'
import { SlicePattern } from './SlicePattern'

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
                  pattern: any
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
        expr: ({ name, value }) => (console.log('VAR', name, value), {
          type: 'VariablePattern',
          name,
          value
        })
      }),
      s => SlicePattern(s)
    ]
  })
})
