import { tests } from './pattern.test.ts'
import { Scope } from '../scope.ts'
import { not } from './not.ts'
import { ok } from './ok.ts'
import { fail } from './fail.ts'

tests('patterns.not', () => [
  {
    id: 'NOT00',
    description: 'fails on ok',
    pattern: () => not({ pattern: ok() }),
    input: Scope.Default(),
    matched: false
  },
  {
    id: 'NOT00',
    description: 'succeeds on fail',
    pattern: () => not({ pattern: fail() }),
    input: Scope.Default(),
  },
  {
    id: 'NOT00',
    description: 'succeeds on not not ok',
    pattern: () => not({ pattern: not({ pattern: ok() }) }),
    input: Scope.Default(),
  },
  {
    id: 'NOT00',
    description: 'consumes no input',
    pattern: () => not({ pattern: fail() }),
    input: 'a',
    done: false,
  }
])
