import { rule, or } from '../../patterns/mod.ts'
import { ObjectKeyReferencePattern } from './ObjectKeyReferencePattern.ts'
import { ObjectKeyWithPattern } from './ObjectKeyWithPattern.ts'
import { ObjectKeyVariablePattern } from './ObjectKeyVariablePattern.ts'
import { ObjectKeyVariableWithPattern } from './ObjectKeyVariableWithPattern.ts'

export const ObjectKeyPattern = rule({
  name: 'ObjectKeyPattern',
  pattern: or({
    patterns: [
      s => ObjectKeyVariableWithPattern(s), // { x:y = z }
      s => ObjectKeyVariablePattern(s),     // { x:y }
      s => ObjectKeyWithPattern(s),         // { x = z }
      s => ObjectKeyReferencePattern(s),    // { x }
    ]
  })
})
