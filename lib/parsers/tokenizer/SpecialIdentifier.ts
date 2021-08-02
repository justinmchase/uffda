import { equal, or, projection, slice, then, variable } from '../../patterns/mod.ts'
import { Letter } from './Letter.ts'
import { Digit } from './Digit.ts'

// Identifier = '$' (Digit | Character)+
export const SpecialIdentifier = projection({
  pattern: then({
    patterns: [
      equal({ value: '$' }),
      variable({
        name: 'value',
        pattern: slice({
          min: 1,
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
  expr: ({ value }: { value: string[] }) => '$' + value.join('')
})