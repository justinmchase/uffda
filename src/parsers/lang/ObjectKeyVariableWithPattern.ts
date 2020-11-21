import { any, equal, object, projection, rule, then, variable } from '../../patterns'
import { PatternExpression } from './PatternExpression'

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
              pattern: any
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
    expr: ({ alias, name, pattern }) => ({
      type: 'VariablePattern',
      name: alias,
      value: {
        type: 'ObjectKeyPattern',
        name,
        pattern
      }
    })
  })
})
