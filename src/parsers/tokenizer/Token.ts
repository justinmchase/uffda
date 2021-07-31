
import { any, slice, regexp, or, projection, variable, then } from '../../patterns'

export const Token = regexp({
  pattern: /[^\w\d\s]/
})
