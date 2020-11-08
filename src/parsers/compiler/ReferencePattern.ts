import { any, equal, object, or, projection, reference, rule, variable } from '../../patterns'

export const ReferencePattern = rule({
  name: 'ReferencePattern',
  pattern: projection({
    pattern: object({
      keys: {
        type: equal({ value: 'ReferencePattern' }),
        value: variable({
          name: 'value',
          pattern: any, // String
        })
      }
    }),
    expr: ({ value }) => (console.log('REFERENCE', value), reference(value))
  })
})
