import { tests } from '../../pattern.test.ts'
import { TerminalPattern } from './TerminalPattern.ts'

tests('parsers.lang.terminal', () => [
  {
    id: 'TERMINAL00',
    description: 'Can parse string',
    pattern: () => TerminalPattern,
    input: [
      { type: 'String', value: 'test' }
    ],
    value: {
      type: 'StringPattern',
      value: 'test'
    }
  },
  {
    id: 'TERMINAL01',
    description: 'Can parse reference',
    pattern: () => TerminalPattern,
    input: [
      { type: 'Identifier', value: 'x' }
    ],
    value: {
      type: 'ReferencePattern',
      value: 'x'
    }
  },
  {
    id: 'TERMINAL02',
    description: 'Can parse special reference',
    pattern: () => TerminalPattern,
    input: [
      { type: 'SpecialIdentifier', value: '$0' }
    ],
    value: {
      type: 'SpecialReferencePattern',
      value: '$0'
    }
  },
  {
    id: 'TERMINAL03',
    description: 'Can parse object',
    pattern: () => TerminalPattern,
    input: [
      { type: 'Token', value: '{' },
      { type: 'Token', value: '}' },
    ],
    value: {
      type: 'ObjectPattern',
      keys: []
    }
  },
])
