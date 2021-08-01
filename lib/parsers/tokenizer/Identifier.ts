import { or, projection, rule, slice, then, variable } from '../../patterns'
import { Letter } from './Letter'
import { Digit } from './Digit'

// Identifier = Letter+ (Digit | Character)*
export const Identifier = rule({
  name: 'Identifier',
  pattern: projection({
    pattern: then({
      patterns: [
        variable({
          name: 'a',
          pattern: slice({
            min: 1,
            pattern: Letter,
          })
        }),
        variable({
          name: 'b',
          pattern: slice({
            pattern: or({
              patterns: [
                Digit,
                Letter
              ]
            })
          })
        })
      ]
    }),
    expr: ({ a, b }) => a.join('') + b.join('')
  })
})
