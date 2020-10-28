import { deepStrictEqual } from 'assert'
import { Scope } from '../../scope'
import { ThenPattern } from './ThenPattern'

describe('/parsers/lang/ThenPattern', () => {
  it('can parse as a reference', () => {
    const p = ThenPattern
    const s = Scope.From([
      { type: 'Identifier', value: 'x' }
    ])
    const { matched, value } = p(s)
    deepStrictEqual({ matched, value }, {
      matched: true,
      value: {
        type: 'ReferencePattern',
        value: 'x'
      }
    })
  })

  it('can parse x then y references', () => {
    const p = ThenPattern
    const s = Scope.From([
      { type: 'Identifier', value: 'x' },
      { type: 'Identifier', value: 'y' },
    ])
    const { matched, value } = p(s)
    deepStrictEqual({ matched, value }, {
      matched: true,
      value: {
        type: 'ThenPattern',
        left: {
          type: 'ReferencePattern',
          value: 'x'
        },
        right: {
          type: 'ReferencePattern',
          value: 'y'
        }
      }
    })
  })

  it('can parse variable string', () => {
    const p = ThenPattern
    const s = Scope.From([
      { type: 'Identifier', value: 'x' },
      { type: 'Token', value: ':' },
      { type: 'String', value: 'abc' },
      { type: 'Identifier', value: 'y' },
    ])
    const { matched, value } = p(s)
    deepStrictEqual({ matched, value }, {
      matched: true,
      value: {
        type: 'ThenPattern',
        left: {
          type: 'VariablePattern',
          name: 'x',
          value: {
            type: 'StringPattern',
            value: 'abc'
          }
        },
        right: {
          type: 'ReferencePattern',
          value: 'y'
        }
      }
    })
  })
})
