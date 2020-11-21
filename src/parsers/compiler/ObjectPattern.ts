import { any, equal, object, ok, or, projection, reference, rule, variable } from '../../patterns'
import { PatternExpression } from './PatternExpression'

export const ObjectKeyPattern = rule({
  name: 'ObjectKeyPattern',
  pattern: projection({
    pattern: object({
      keys: {
        type: equal({ value: 'ObjectKeyPattern' }),
        name: variable({
          name: 'name',
          pattern: any // String
        }),
        pattern: variable({
          name: 'pattern',
          pattern: or({
            patterns: [
              s => PatternExpression(s),
              ok
            ]
          })
        })
      }
    }),
    expr: ({ name, pattern = ok }) => ({ [name]: pattern })
  })
})

export const ObjectPattern = rule({
  name: 'ObjectPattern',
  pattern: projection({
    pattern: object({
      keys: {
        type: equal({ value: 'ObjectPattern' }),
        keys: variable({
          name: 'keys',
          pattern: ObjectKeyPattern
        })
      }
    }),
    expr: ({ keys }) => (console.log('OBJECT', keys), object({ keys: Object.assign(keys) }))
  })
})
