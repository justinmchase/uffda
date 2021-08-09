import { string, regexp, projection, variable, object, rule } from '../../patterns/mod.ts'

export const ReferencePattern = rule({
  name: 'ReferencePattern',
  pattern: projection({
    pattern: object({
      keys: {
        type: regexp({ pattern: /^Identifier$/ }),
        value: variable({
          name: 'value',
          pattern: string()
        })
      }
    }),
    expr: ({ value }) => ({
      type: 'ReferencePattern',
      value
    })
  })
})
