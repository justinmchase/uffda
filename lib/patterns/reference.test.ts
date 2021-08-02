import { tests } from '../pattern.test.ts'
import { block } from './block.ts'
import { equal } from './equal.ts'
import { reference } from './reference.ts'


tests('patterns.reference', () => [
  {
    id: 'REFERENCE00',
    description: 'can reference other pattern',
    pattern: () => block({
      A: equal({ value: 'a' }),
      Main: reference('A')
    }),
    input: 'a',
    value: 'a',
  }
])
