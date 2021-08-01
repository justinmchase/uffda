import { tests } from './pattern.test.ts'
import { Scope } from '../scope.ts'
import { ok } from './ok.ts'

tests('patterns.ok', () => [
  {
    id: 'OK00',
    description: 'ok matches empty input',
    pattern: () => ok(),
    input: Scope.Default(),
  },
  {
    id: 'OK01',
    description: 'ok consumes no input',
    pattern: () => ok(),
    input: 'a',
    done: false
  }
])