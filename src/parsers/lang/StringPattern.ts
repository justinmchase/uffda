import { any, equal, object, projection, rule, then, variable } from '../../patterns'

export const StringPattern = rule({
  name: 'StringPattern',
  pattern: projection({
    pattern: object({
      keys: {
        type: equal({ value: 'String' }),
        value: variable({
          name: 'value',
          pattern: any // String
        })
      }
    }),
    expr: ({ value, _ }) => ({ type: 'StringPattern', value, })
  })
})
