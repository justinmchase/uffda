import { deepStrictEqual } from 'assert'
import { pipeline } from '../patterns'
import { Scope } from '../scope'
import { Exclusion } from './exclusion'
import { Lang } from './lang'
import { meta } from './meta'
import { Tokenizer } from './tokenizer'

describe('/parsers/meta/endtoend', () => {
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
      code: ' x = y:z -> $0',
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
          expression: {
            type: 'SpecialReferencePattern',
            value: '$0'
          }
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

  const p = pipeline({
    steps: [
      { name: 'a', pattern: Tokenizer },
      { name: 'b', pattern: Exclusion({ types: ['Whitespace', 'Newline'] }) },
      { name: 'c', pattern: Lang },
    ]
  })

  tests.forEach(({ code, ast }, i) => {
    it(`e2e ${i}`, () => {
      const s = Scope.From(code)
      const { matched, done, value } = p(s)
      deepStrictEqual({ matched, done, value }, {
        matched: true,
        done: true,
        value: [ast]
      })
    })
  })
})
