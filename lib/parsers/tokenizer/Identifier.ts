import { or, projection, rule, slice, then, variable } from '../../patterns/mod.ts'
import { Letter } from './Letter.ts'
import { Digit } from './Digit.ts'

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
    expr: ({ a, b }: { a: string[], b: string[] }) => a.join('') + b.join('')
  })
})
