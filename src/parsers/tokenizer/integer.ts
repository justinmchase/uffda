import { projection, slice } from '../../patterns'
import { Digit } from './digit'

export const Integer = projection({
  pattern: slice({
    min: 1,
    pattern: Digit
  }),
  expr: ({ _ }) => _.join('')
})
