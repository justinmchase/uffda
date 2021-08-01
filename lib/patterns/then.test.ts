import { tests } from './pattern.test.ts'
import { Scope } from '../scope.ts'
import { then } from './then.ts'
import { any } from './any.ts'
import { ok } from './ok.ts'

tests('patterns.then', () => [
  {
    id: 'THEN00',
    description: 'no patterns is success',
    pattern: () => then({
      patterns: []
    }),
    input: Scope.Default(),
  },
  {
    id: 'THEN01',
    description: 'reads one pattern successfuly',
    pattern: () => then({
      patterns: [any()]
    }),
    input: 'a',
    value: ['a']
  },
  {
    id: 'THEN02',
    description: 'reads two patterns successfuly',
    pattern: () => then({
      patterns: [any(), any()]
    }),
    input: 'ab',
    value: ['a', 'b']
  },
  {
    id: 'THEN03',
    description: 'does not read too much',
    pattern: () => then({
      patterns: [any(), any()]
    }),
    input: 'abc',
    value: ['a', 'b'],
    done: false
  },
  {
    id: 'THEN04',
    description: 'it doesnt fail if at the end',
    pattern: () => then({
      patterns: [ok()]
    }),
    input: Scope.Default(),
    value: [undefined],
  },
  {
    id: 'THEN05',
    description: 'it fails if it reaches the end',
    pattern: () => then({
      patterns: [any(), any()]
    }),
    input: 'a',
    matched: false
  }
])
