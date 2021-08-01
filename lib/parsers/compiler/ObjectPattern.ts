import { any, array, equal, object, ok, or, projection, rule, slice, variable } from '../../patterns/mod.ts'
import { PatternExpression } from './PatternExpression.ts'

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
    expr: ({ name, pattern = ok }) => (console.log('KEY', name, pattern), { [name]: pattern })
  })
})

// ObjectPattern = {
//   type: 'ObjectPattern',
//   k:keys = [ObjectKeyPattern*]
// }
export const ObjectPattern = rule({
  name: 'ObjectPattern',
  pattern: projection({
    pattern: object({
      keys: {
        type: equal({ value: 'ObjectPattern' }),
        keys: variable({
          name: 'k',
          pattern: array({
            pattern: slice({
              min: 0,
              pattern: ObjectKeyPattern
            })
          })
        })
      }
    }),
    expr: ({ k }) => (console.log('OBJECT', k), object({ keys: Object.assign({}, ...k) }))
  })
})
