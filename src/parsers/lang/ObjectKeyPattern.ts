import { any, regexp, projection, variable, object, rule, equal, then, slice, or } from '../../patterns'
import { ObjectKeyReferencePattern } from './ObjectKeyReferencePattern'
import { ObjectKeyWithPattern } from './ObjectKeyWithPattern'
import { ObjectKeyVariablePattern } from './ObjectKeyVariablePattern'
import { ObjectKeyVariableWithPattern } from './ObjectKeyVariableWithPattern'

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
