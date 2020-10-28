import { deepStrictEqual } from 'assert'
import { Scope } from '../scope'
import { any } from './any'
import { includes } from './includes'
import { object } from './object'

describe('/patterns/object', () => {
  it('matches an object without keys', () => {
    const p = object({
      keys: {}
    })
    const s = Scope.From([{}])
    const { matched, done, value } = p(s)
    deepStrictEqual({ matched, done, value }, {
      matched: true,
      done: true,
      value: {}
    })
  })

  it('matches an object with extra keys', () => {
    const p = object({
      keys: {}
    })
    const s = Scope.From([{ x: 'a' }])
    const { matched, done, value } = p(s)
    deepStrictEqual({ matched, done, value }, {
      matched: true,
      done: true,
      value: { x: 'a' }
    })
  })

  it('matches an object and key', () => {
    const p = object({
      keys: {
        x: any
      }
    })
    const s = Scope.From([{ x: 'a' }])
    const { matched, done, value } = p(s)
    deepStrictEqual({ matched, done, value }, {
      matched: true,
      done: true,
      value: { x: 'a' }
    })
  })

  it('fails to match an object missing a key', () => {
    const p = object({
      keys: {
        x: any
      }
    })
    const s = Scope.From([{}])
    const { matched, done, value } = p(s)
    deepStrictEqual({ matched, done, value }, {
      matched: false,
      done: false,
      value: undefined
    })
  })

  it('matches if all keys match', () => {
    const p = object({
      keys: {
        type: includes({ values: ['x', 'y'] })
      }
    })
    const s = Scope.From([{ type: 'x', value: 'y' }])
    const { matched, done, value } = p(s)
    deepStrictEqual({ matched, done, value }, {
      matched: true,
      done: true,
      value: {
        type: 'x',
        value: 'y'
      }
    })
  })
})
