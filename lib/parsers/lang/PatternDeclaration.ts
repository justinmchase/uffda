import { string, projection, variable, then, object, rule, equal } from '../../patterns/mod.ts'
import { PatternExpression } from './PatternExpression.ts'

export const PatternDeclaration = rule({
  name: 'PatternDeclaration',
  pattern: projection({
    pattern: then({
      patterns: [
        object({
          keys: {
            type: equal({ value: 'Identifier' }),
            value: variable({ name: 'name', pattern: string() })
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
        }),
        object({
          keys: {
            type: equal({ value: 'Token' }),
            value: equal({ value: ';' })
          }
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
