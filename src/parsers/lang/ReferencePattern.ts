import { any, regexp, projection, variable, object, rule } from '../../patterns'

export const ReferencePattern = rule({
  name: 'ReferencePattern',
  pattern: projection({
    pattern: object({
      keys: {
        type: regexp({ pattern: /Identifier/ }),
        value: variable({
          name: 'value',
          pattern: any
        })
      }
    }),
    expr: ({ value }) => ({
      type: 'ReferencePattern',
      value
    })
  })
})
