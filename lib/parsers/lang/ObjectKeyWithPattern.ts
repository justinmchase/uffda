import { string, equal, object, projection, rule, then, variable } from '../../patterns/mod.ts'
import { PatternExpression } from './PatternExpression.ts'

// The key of an object pattern which has a pattern
//
// e.g.
// key = pattern
export const ObjectKeyWithPattern = rule({
  name: 'ObjectKeyWithPattern',
  pattern: projection({
    pattern: then({
      patterns: [
        object({
          keys: {
            type: equal({ value: 'Identifier' }),
            value: variable({
              name: 'name',
              pattern: string()
            })
          }
        }),
        object({
          keys: {
            type: equal({ value: 'Token' }),
            value: equal({ value: '=' })
          }
        }),
        variable({
          name: 'pattern',
          pattern: s => PatternExpression(s)
        })
      ]
    }),
    expr: ({ name, pattern }) => ({
      type: 'ObjectKeyPattern',
      name,
      pattern
    })
  })
})
