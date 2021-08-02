import { regexp } from '../../patterns/mod.ts'

export const Letter = regexp({
  pattern: /\p{L}/u
})
