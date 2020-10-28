import { or, projection, slice, then, variable } from '../../patterns'
import { Letter } from './letter'
import { Digit } from './digit'

// Identifier = Letter+ (Digit | Character)*
export const Identifier = projection({
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
