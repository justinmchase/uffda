import { deepStrictEqual } from 'assert'
import { Scope } from '../../scope'
import { ProjectionPattern } from './ProjectionPattern'

describe('/parsers/lang/projectionpattern', () => {
  it('can parse a projection', () => {
    const p = ProjectionPattern
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

  it('can parse a variable', () => {
    const f = () => undefined
    const p = ProjectionPattern
    const s = Scope
      .From([
        { type: 'Identifier', value: 'x' },
        { type: 'Token', value: ':' },
        { type: 'Identifier', value: 'y' },
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
          type: 'VariablePattern',
          name: 'x',
          value: {
            type: 'ReferencePattern',
            value: 'y'
          }
        },
        expression: {
          type: 'SpecialReferencePattern',
          value: '$0'
        }
      }
    })
  })
})
