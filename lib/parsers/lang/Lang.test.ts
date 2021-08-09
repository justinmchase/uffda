import { tests } from '../../pattern.test.ts'
import { pipeline } from '../../patterns/mod.ts'
import { Basic, Lang } from '../mod.ts'

const TestLang = pipeline({
  steps: [
    Basic,
    Lang
  ]
})

tests('parsers.lang.Lang', () => [
  {
    id: 'LANG00',
    description: 'empty is valid',
    pattern: () => TestLang,
    input: '',
    value: []
  },
  {
    id: 'LANG01',
    description: 'whitespace is valid',
    pattern: () => TestLang,
    input: '\t\n \n',
    value: []
  },
  {
    id: 'LANG02',
    description: 'Can parse a pattern declaration',
    pattern: () => TestLang,
    input: "Main = 'X';",
    value: [
      {
        type: 'PatternDeclaration',
        name: 'Main',
        pattern: {
          type: 'StringPattern',
          value: 'X'
        }
      }
    ]
  },
  {
    id: 'LANG03',
    description: 'Can parse a pattern declarations with special refs',
    pattern: () => TestLang,
    input: `
      A = Int;
      B = A -> $0;
    `,
    value: [
      {
        type: 'PatternDeclaration',
        name: 'A',
        pattern: {
          type: 'ReferencePattern',
          value: 'Int'
        }
      },
      {
        type: 'PatternDeclaration',
        name: 'B',
        pattern: {
          type: 'ProjectionPattern',
          pattern: {
            type: 'ReferencePattern',
            value: 'A'
          },
          expression: {
            type: 'SpecialReferencePattern',
            value: '$0'
          }
        }
      }
    ]
  }
])
