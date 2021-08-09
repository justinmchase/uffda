import { tests } from '../../pattern.test.ts'
import { OneOrMorePattern } from './OneOrMorePattern.ts'

tests('parsers.lang.oneormore', () => [
  {
    id: "ONEORMORE00",
    description: 'parse one or more reference',
    pattern: () => OneOrMorePattern,
    input: [
      { type: 'Identifier', value: 'x' },
      { type: 'Token', value: '+' }
    ],
    value: {
      type: 'OneOrMorePattern',
      pattern: {
        type: 'ReferencePattern',
        value: 'x'
      }
    }
  }
])
