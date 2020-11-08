import { any, equal, object, or, projection, rule, then, variable } from '../../patterns'
import { VariablePattern } from './VariablePattern'

export const ThenPattern = rule({
  name: 'ThenPattern',
  pattern: or({
    patterns: [
      projection({
        pattern: object({
          keys: {
            type: equal({ value: 'ThenPattern' }),
            left: variable({
              name: 'left',
              pattern: s => ThenPattern(s),
            }),
            right: variable({
              name: 'right',
              pattern: VariablePattern
            })
          }
        }),
        expr: ({ left, right }) => (console.log('THEN', { left, right }), then({ patterns: [left, right] }))
      }),
      VariablePattern
    ]
  })
})
