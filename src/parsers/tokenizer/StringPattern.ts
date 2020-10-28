import { any, equal, not, or, projection, rule, slice, then, variable } from '../../patterns'
import { Letter } from './letter'
import { Digit } from './digit'

// StringPattern
//   = '\'' value:(('\\' '\'') -> '\'' | any)* '\'' -> ({ type: 'String', value: s.join('') })
export const StringPattern = rule({
  name: 'StringPattern',
  pattern: projection({
    pattern: then({
      patterns: [
        equal({ value: '\'' }),
        variable({
          name: 'value',
          pattern: slice({
            pattern: or({
              patterns: [
                projection({
                  pattern: then({
                    patterns: [
                      equal({ value: '\\' }),
                      equal({ value: '\'' }),
                    ]
                  }),
                  expr: () => '\''
                }),
                projection({
                  pattern: then({
                    patterns: [
                      not({ pattern: equal({ value: '\'' }) }),
                      variable({
                        name: 'value',
                        pattern: any
                      })
                    ]
                  }),
                  expr: ({ value }) => value
                })
              ]
            })
          })
        }),
        equal({ value: '\'' })
      ]
    }),
    expr: ({ value }) => (console.log('UGH:', value), { type: 'String', value: value.join('') })
  })
})
