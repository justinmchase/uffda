import { tests } from '../../pattern.test.ts'
import { PatternDeclaration } from './PatternDeclaration.ts'

tests('parsers.lang.patterndeclaration', () => [
  {
    id: 'PATTERNDEC00',
    description: 'can parse pattern declaration',
    pattern: () => PatternDeclaration,
    input: [
        { type: 'Identifier', value: 'x' },
        { type: 'Token', value: '=' },
        { type: 'Identifier', value: 'y' },
        { type: 'Token', value: ';' }
      ],
    value: {
      type: 'PatternDeclaration',
      name: 'x',
      pattern: {
        type: 'ReferencePattern',
        value: 'y'
      }
    }
  },
  {
    id: 'PATTERNDEC01',
    description: 'can parse pattern declaration with variable',
    pattern: () => PatternDeclaration,
    input: [
      { type: 'Identifier', value: 'x' },
      { type: 'Token', value: '=' },
      { type: 'Identifier', value: 'y' },
      { type: 'Token', value: ':', },
      { type: 'Identifier', value: 'z' },
      { type: 'Token', value: ';' },
    ],
    value: {
      type: 'PatternDeclaration',
      name: 'x',
      pattern: {
        type: 'VariablePattern',
        name: 'y',
        value: {
          type: 'ReferencePattern',
          value: 'z'
        }
      }
    }
  }
])
