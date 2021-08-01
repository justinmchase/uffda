import { slice, or } from '../../patterns/mod.ts'
import { PatternDeclaration } from './PatternDeclaration.ts'

export const Lang = slice({
  pattern: or({
    patterns: [
      PatternDeclaration
    ]
  })
})
