import { any, regexp, projection, variable, object, rule, then, or } from '../../patterns'
import { OneOrMorePattern } from './OneOrMorePattern'

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
              pattern: s => OneOrMorePattern(s)
            })
          ]
        }),
        expr: ({ name, value }) => ({
          type: 'VariablePattern',
          name,
          value
        })
      }),
      s => OneOrMorePattern(s)
    ]
  })
})
