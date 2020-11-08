import { equal, or, projection, slice, then, variable } from '../../patterns'
import { Letter } from './Letter'
import { Digit } from './Digit'

// Identifier = '$' Letter+ (Digit | Character)*
export const SpecialIdentifier = projection({
  pattern: then({
    patterns: [
      equal({ value: '$' }),
      variable({
        name: 'value',
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
  expr: ({ value }) => '$' + value.join('')
})
