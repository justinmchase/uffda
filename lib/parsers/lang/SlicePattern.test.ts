import { tests } from '../../pattern.test.ts'
import { SlicePattern } from './SlicePattern.ts'

tests('parsers.lang.slice', () => [
  {
    id: 'SLICE00',
    description: 'parses a terminal',
    pattern: () => SlicePattern,
    input: [
      { type: 'Identifier', value: 'x' },
    ],
    value: {
      type: 'ReferencePattern',
      value: 'x'
    }
  },
  {
    id: 'SLICE01',
    description: 'parses one or more',
    pattern: () => SlicePattern,
    input: [
      { type: 'Identifier', value: 'x' },
      { type: 'Token', value: '+' },
    ],
    value: {
      type: 'OneOrMorePattern',
      pattern: {
        type: 'ReferencePattern',
        value: 'x'
      }
    }
  },
  {
    id: 'SLICE02',
    description: 'parses zero or more',
    pattern: () => SlicePattern,
    input: [
      { type: 'Identifier', value: 'x' },
      { type: 'Token', value: '*' },
    ],
    value: {
      type: 'ZeroOrMorePattern',
      pattern: {
        type: 'ReferencePattern',
        value: 'x'
      }
    }
  },
  {
    id: 'SLICE03',
    description: 'parses zero or one',
    pattern: () => SlicePattern,
    input: [
      { type: 'Identifier', value: 'x' },
      { type: 'Token', value: '?' },
    ],
    value: {
      type: 'ZeroOrOnePattern',
      pattern: {
        type: 'ReferencePattern',
        value: 'x'
      }
    }
  }
])
