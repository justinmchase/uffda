import { string, equal, object, projection, rule, then, variable } from '../../patterns/mod.ts'

export const ObjectKeyVariablePattern = rule({
  name: 'ObjectKeyVariablePattern',
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
        })
      ]
    }),
    expr: ({ alias, name }) => ({
      type: 'ObjectKeyPattern',
      alias,
      name,
    })
  })
})
