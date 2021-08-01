import { regexp } from '../../patterns/mod.ts'

export const Token = regexp({
  pattern: /[^\w\d\s]/
})
