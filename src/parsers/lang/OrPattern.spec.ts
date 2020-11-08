import { deepStrictEqual } from 'assert'
import { Scope } from '../../scope'
import { OrPattern } from './OrPattern'

describe('/parsers/lang/orpattern', () => {
  it('can parse a reference expression', () => {
    const p = OrPattern
    const s = Scope
      .From([
        { type: 'Identifier', value: 'x' },
      ])

    const { matched, done, value } = p(s)
    deepStrictEqual({ matched, done, value }, {
      matched: true,
      done: true,
      value: {
        type: 'ReferencePattern',
        value: 'x'
      }
    })
  })

  it('can parse a projection expression', () => {
    const p = OrPattern
    const s = Scope
      .From([
        { type: 'Identifier', value: 'x' },
        { type: 'Token', value: '-' },
        { type: 'Token', value: '>' },
        { type: 'SpecialIdentifier', value: '$0' }
      ])

    const { matched, done, value } = p(s)
    deepStrictEqual({ matched, done, value }, {
      matched: true,
      done: true,
      value: {
        type: 'ProjectionPattern',
        pattern: {
          type: 'ReferencePattern',
          value: 'x'
        },
        expression: {
          type: 'SpecialReferencePattern',
          value: '$0'
        }
      }
    })
  })

  it('can parse two reference expressions', () => {
    const p = OrPattern
    const s = Scope
      .From([
        { type: 'Identifier', value: 'x' },
        { type: 'Token', value: '|' },
        { type: 'Identifier', value: 'y' },
      ])

    const { matched, done, value } = p(s)
    deepStrictEqual({ matched, done, value }, {
      matched: true,
      done: true,
      value: {
        type: 'OrPattern',
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

  it('can parse two then expressions', () => {
    const p = OrPattern
    const s = Scope
      .From([
        { type: 'Identifier', value: 'w' },
        { type: 'Identifier', value: 'x' },
        { type: 'Token', value: '|' },
        { type: 'Identifier', value: 'y' },
        { type: 'Identifier', value: 'z' },
      ])

    const { matched, done, value } = p(s)
    deepStrictEqual({ matched, done, value }, {
      matched: true,
      done: true,
      value: {
        type: 'OrPattern',
        left: {
          type: 'ThenPattern',
          left: {
            type: 'ReferencePattern',
            value: 'w'
          },
          right: {
            type: 'ReferencePattern',
            value: 'x'
          }
        },
        right: {
          type: 'ThenPattern',
          left: {
            type: 'ReferencePattern',
            value: 'y'
          },
          right: {
            type: 'ReferencePattern',
            value: 'z'
          }
        },
      }
    })
  })
})
