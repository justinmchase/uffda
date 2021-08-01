import { any, equal, object, projection, rule, variable } from '../../patterns/mod.ts'

export const ObjectKeyReferencePattern = rule({
  name: 'ObjectKeyReferencePattern',
  pattern: projection({
    pattern: object({
      keys: {
        type: equal({ value: 'Identifier' }),
        value: variable({
          name: 'name',
          pattern: any
        })
      }
    }),
    expr: ({ name }) => ({
      type: 'ObjectKeyPattern',
      name
    })
  })
})
