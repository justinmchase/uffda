import { tests } from '../../pattern.test.ts'
import { ZeroOrMorePattern } from './ZeroOrMorePattern.ts'

tests('parsers.lang.zeroormorepattern', () => [
  {
    id: 'ZERORMROE00',
    description: 'can parse a*',
    pattern: () => ZeroOrMorePattern,
    input: [
      { type: 'Identifier', value: 'a' },
      { type: 'Token', value: '*' },
    ],
    value: {
      type: 'ZeroOrMorePattern',
      pattern: {
        type: 'ReferencePattern',
        value: 'a',
      }
    }
  }
])