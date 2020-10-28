import { projection, variable, rule, or, then } from '../../patterns'
import { VariablePattern } from './VariablePattern'

// ThenPattern
//   = left:ThenPattern right:VariablePattern -> ({ type: 'ThenPattern', left right })
//   | VariablePattern
export const ThenPattern = rule({
  name: 'ThenPattern',
  pattern: or({
    patterns: [
      projection({
        pattern: then({
          patterns: [
            variable({
              name: 'left',
              pattern: s => ThenPattern(s)
            }),
            variable({
              name: 'right',
              pattern: s => VariablePattern(s)
            }),
          ]
        }),
        expr: ({ left, right }) => ({ type: 'ThenPattern', left, right })
      }),
      s => VariablePattern(s)
    ]
  })
})
