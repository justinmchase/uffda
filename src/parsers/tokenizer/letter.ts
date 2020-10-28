import { any, slice, regexp, or, projection, variable, then } from '../../patterns'

export const Letter = regexp({
  pattern: /\p{L}/u
})
