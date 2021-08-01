import { tests } from './pattern.test.ts'
import { fail } from './fail.ts'

tests('patterns.fail', () => [
  {
    id: 'FAIL00',
    description: 'fail pattern fails',
    pattern: () => fail(),
    input: 'a',
    matched: false,
    done: false
  }
])
