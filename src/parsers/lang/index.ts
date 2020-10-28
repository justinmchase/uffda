import { slice, or, projection, array } from '../../patterns'
import { PatternDeclaration } from './PatternDeclaration'

export const Lang = slice({
  pattern: or({
    patterns: [
      PatternDeclaration
    ]
  })
})
