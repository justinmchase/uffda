import { any, equal, object, projection, rule, variable } from '../../patterns'
import { PatternExpression } from './PatternExpression'

export const PatternDeclaration = rule({
  name: 'PatternDeclaration',
  pattern: projection({
    pattern: object({
      keys: {
        type: equal({ value: 'PatternDeclaration' }),
        name: variable({
          name: 'name',
          pattern: any
        }),
        pattern: variable({
          name: 'pattern',
          pattern: PatternExpression
        })
      }
    }),
    expr: ({ name, pattern }) => (console.log('PATTERN DECLARATION', name, pattern), { [name]: rule({ name, pattern }) })
  })
})
