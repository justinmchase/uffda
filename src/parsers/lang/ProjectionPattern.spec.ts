import { deepStrictEqual } from 'assert'
import { Scope } from '../../scope'
import { ProjectionPattern } from './ProjectionPattern'

describe('/parsers/lang/projectionpattern', () => {
  it('can parse a projection', () => {
    const f = () => undefined
    const p = ProjectionPattern
    const s = Scope
      .From([
        { type: 'Identifier', value: 'x' },
        { type: 'Token', value: '-' },
        { type: 'Token', value: '>' },
        { type: 'Identifier', value: 'f' }
      ])
      .addProjections({ f })

    const { matched, done, value } = p(s)
    console.log(value)

    deepStrictEqual({ matched, done, value }, {
      matched: true,
      done: true,
      value: {
        type: 'ProjectionPattern',
        pattern: {
          type: 'ReferencePattern',
          value: 'x'
        },
        expression: f
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
        { type: 'Identifier', value: 'f' }
      ])
      .addProjections({ f })

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
        expression: f
      }
    })
  })
})
