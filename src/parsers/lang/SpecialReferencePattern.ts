import { any, regexp, projection, variable, object, rule } from '../../patterns'

export const SpecialReferencePattern = rule({
  name: 'SpecialReferencePattern',
  pattern: projection({
    pattern: object({
      keys: {
        type: regexp({ pattern: /SpecialIdentifier/ }),
        value: variable({
          name: 'value',
          pattern: any
        })
      }
    }),
    expr: ({ value }) => ({
      type: 'SpecialReferencePattern',
      value,
    })
  })
})
