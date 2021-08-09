import { tests } from '../../pattern.test.ts'
import { VariablePattern } from './VariablePattern.ts'

tests('parsers.lang.variablepattern', () => [
  {
    id: 'VARIABLEPATTERN00',
    description: 'can parse a reference as a variable',
    pattern: () => VariablePattern,
    input: [
      { type: 'Identifier', value: 'x' },
      { type: 'Token', value: ':' },
      { type: 'Identifier', value: 'y' }
    ],
    value: {
      type: 'VariablePattern',
      name: 'x',
      value: {
        type: 'ReferencePattern',
        value: 'y'
      }
    }
    
  },
  {
    id: 'VARIABLEPATTERN00',
    description: 'can parse a reference as a reference',
    pattern: () => VariablePattern,
    input: [
      { type: 'Identifier', value: 'x' }
    ],
    value: {
      type: 'ReferencePattern',
      value: 'x'
    }
  }
])
