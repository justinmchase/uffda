import { deepStrictEqual } from 'assert'
import { Scope } from '../scope'
import { includes } from './includes'

// todo
describe('/patterns/includes', () => {
  it('can match single included value', () => {
    const p = includes({ values: ['x'] })
    const s = Scope.From('x')
    const { matched, value } = p(s)
    deepStrictEqual({ matched, value }, {
      matched: true,
      value: 'x'
    })
  })

  it('can match single included value in set of values', () => {
    const p = includes({ values: ['x', 'y', 'z'] })
    const s = Scope.From('y')
    const { matched, value } = p(s)
    deepStrictEqual({ matched, value }, {
      matched: true,
      value: 'y'
    })
  })

  it('fails to match if not in set of values', () => {
    const p = includes({ values: ['x', 'y', 'z'] })
    const s = Scope.From('a')
    const { matched, value } = p(s)
    deepStrictEqual({ matched, value }, {
      matched: false,
      value: undefined
    })
  })
})
