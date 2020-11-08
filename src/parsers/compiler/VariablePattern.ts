import { any, equal, object, or, projection, rule, then, variable } from '../../patterns'
import { TerminalPattern } from './TerminalPattern'

export const VariablePattern = rule({
  name: 'VariablePattern',
  pattern: or({
    patterns: [
      projection({
        pattern: object({
          keys: {
            type: equal({ value: 'VariablePattern' }),
            name: variable({
              name: 'name',
              pattern: any, // String
            }),
            value: variable({
              name: 'pattern',
              pattern: TerminalPattern
            })
          }
        }),
        expr: ({ name, pattern }) => (console.log('VARIABLE', { name, pattern }), variable({ name, pattern }))
      }),
      TerminalPattern
    ]
  })
})
