import { projection, slice } from '../../patterns'
import { Digit } from './Digit'

export const Integer = projection({
  pattern: slice({
    min: 1,
    pattern: Digit
  }),
  expr: ({ _ }) => _.join('')
})
