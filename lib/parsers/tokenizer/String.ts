import { any, equal, not, or, projection, rule, slice, then, variable } from '../../patterns/mod.ts'
import { Letter } from './Letter.ts'
import { Digit } from './Digit.ts'

// StringPattern
//   = '\'' value:(('\\' '\'') -> '\'' | any)* '\'' -> s.join('')
export const String = rule({
  name: 'String',
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
    expr: ({ value }) => value.join('')
  })
})
