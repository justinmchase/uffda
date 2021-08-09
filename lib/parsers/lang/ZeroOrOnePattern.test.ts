import { tests } from '../../pattern.test.ts'
import { ZeroOrOnePattern } from './ZeroOrOnePattern.ts'

tests('parsers.lang.zerooronepattern', () => [
  {
    id: 'ZERORONE00',
    description: 'can parse a?',
    pattern: () => ZeroOrOnePattern,
    input: [
      { type: 'Identifier', value: 'a' },
      { type: 'Token', value: '?' },
    ],
    value: {
      type: 'ZeroOrOnePattern',
      pattern: {
        type: 'ReferencePattern',
        value: 'a',
      }
    }
  }
])