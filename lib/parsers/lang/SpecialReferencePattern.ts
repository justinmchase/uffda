import { string, regexp, projection, variable, object, rule } from '../../patterns/mod.ts'

export const SpecialReferencePattern = rule({
  name: 'SpecialReferencePattern',
  pattern: projection({
    pattern: object({
      keys: {
        type: regexp({ pattern: /SpecialIdentifier/ }),
        value: variable({
          name: 'value',
          pattern: string()
        })
      }
    }),
    expr: ({ value }) => ({
      type: 'SpecialReferencePattern',
      value,
    })
  })
})
