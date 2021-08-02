import { projection, slice } from '../../patterns/mod.ts'
import { Digit } from './Digit.ts'

export const Integer = projection({
  pattern: slice({
    min: 1,
    pattern: Digit
  }),
  expr: ({ _ }: { _: string[] }) => _.join('')
})
