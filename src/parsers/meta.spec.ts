import { deepStrictEqual } from 'assert'
import { Scope } from '../scope'
import { meta } from './meta'

describe('/parsers/meta/endtoend', () => {
  const p0 = () => true
  const tests = [
    {
      code: ' x = y ',
      ast: {
        type: 'PatternDeclaration',
        name: 'x',
        pattern: {
          type: 'ReferencePattern',
          value: 'y'
        }
      }
    },
    {
      code: ' x = y:z ',
      ast: {
        type: 'PatternDeclaration',
        name: 'x',
        pattern: {
          type: 'VariablePattern',
          name: 'y',
          value: {
            type: 'ReferencePattern',
            value: 'z'
          }
        }
      }
    },

    {
      code: ' x = y:z -> p0',
      ast: {
        type: 'PatternDeclaration',
        name: 'x',
        pattern: {
          type: 'ProjectionPattern',
          pattern: {
            type: 'VariablePattern',
            name: 'y',
            value: {
              type: 'ReferencePattern',
              value: 'z'
            }
          },
          expression: p0
        }
      }
    },

    {
      code: ' p = x | y | z',
      ast: {
        type: 'PatternDeclaration',
        name: 'p',
        pattern: {
          type: 'OrPattern',
          left: {
            type: 'OrPattern',
            left: {
              type: 'ReferencePattern',
              value: 'x'
            },
            right: {
              type: 'ReferencePattern',
              value: 'y'
            },
          },
          right: {
            type: 'ReferencePattern',
            value: 'z'
          }
        }
      }
    }
  ]

  tests.forEach(({ code, ast }, i) => {
    it(`e2e ${i}`, () => {
      const p = meta
      const s = Scope.From(code).addProjections({ p0 })
      const { matched, done, value } = p(s)
      deepStrictEqual({ matched, done, value }, {
        matched: true,
        done: true,
        value: [ast]
      })
    })
  })
})
