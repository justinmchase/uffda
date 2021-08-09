import { tests } from '../../pattern.test.ts'
import { SpecialReferencePattern } from './SpecialReferencePattern.ts'

tests('parsers.lang.specialreference', () => [
  {
    id: 'SPECREF00',
    description: 'Can parse special reference',
    pattern: () => SpecialReferencePattern,
    input: [
      { type: 'SpecialIdentifier', value: '$0' }
    ],
    value: {
      type: 'SpecialReferencePattern',
      value: '$0'
    }
  },
])
