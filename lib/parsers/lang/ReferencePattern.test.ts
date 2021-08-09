import { tests } from '../../pattern.test.ts'
import { ReferencePattern } from './ReferencePattern.ts'

tests('parsers.lang.reference', () => [
  {
    id: 'REF00',
    description: 'Can parse reference',
    pattern: () => ReferencePattern,
    input: [
      { type: 'Identifier', value: 'x' }
    ],
    value: {
      type: 'ReferencePattern',
      value: 'x'
    }
  },
])
