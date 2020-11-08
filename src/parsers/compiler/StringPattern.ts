import { any, equal, object, or, projection, reference, rule, variable } from '../../patterns'

export const StringPattern = rule({
  name: 'StringPattern',
  pattern: projection({
    pattern: object({
      keys: {
        type: equal({ value: 'StringPattern' }),
        value: variable({
          name: 'value',
          pattern: any, // Type(Types.String)
        })
      }
    }),
    expr: ({ value, _ }) => (console.log('STRING', value, _), equal({ value }))
  })
})
