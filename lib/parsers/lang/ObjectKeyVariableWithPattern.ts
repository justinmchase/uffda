import { string, equal, object, projection, rule, then, variable } from '../../patterns/mod.ts'
import { PatternExpression } from './PatternExpression.ts'

export const ObjectKeyVariableWithPattern = rule({
  name: 'ObjectKeyVariableWithPattern',
  pattern: projection({
    pattern: then({
      patterns: [
        object({
          keys: {
            type: equal({ value: 'Identifier' }),
            value: variable({
              name: 'alias',
              pattern: string()
            })
          }
        }),
        object({
          keys: {
            type: equal({ value: 'Token' }),
            value: equal({ value: ':' })
          }
        }),
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
    expr: ({ alias, name, pattern }) => ({
      type: 'ObjectKeyPattern',
      alias,
      name,
      pattern
    })
  })
})
