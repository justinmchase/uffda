import { any, regexp, projection, variable, then, object, rule, equal } from '../../patterns'
import { PatternExpression } from './PatternExpression'

export const PatternDeclaration = rule({
  name: 'PatternDeclaration',
  pattern: projection({
    pattern: then({
      patterns: [
        object({
          keys: {
            type: equal({ value: 'Identifier' }),
            value: variable({ name: 'name', pattern: any })
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
          pattern: PatternExpression
        })
      ]
    }),
    expr: ({ name, pattern }) => ({
      type: 'PatternDeclaration',
      name,
      pattern
    })
  })
})
