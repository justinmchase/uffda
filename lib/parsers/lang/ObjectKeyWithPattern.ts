import { any, equal, object, projection, rule, then, variable } from '../../patterns/mod.ts'
import { PatternExpression } from './PatternExpression.ts'

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
              pattern: any
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
