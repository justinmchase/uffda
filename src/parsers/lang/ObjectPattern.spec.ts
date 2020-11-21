import { deepStrictEqual } from 'assert'
import { Scope } from '../../scope'
import { ObjectPattern } from './ObjectPattern'

describe('/parsers/lang/object', () => {
  it('can parse empty object', () => {
    const p = ObjectPattern
    const s = Scope.From([
      { type: 'Token', value: '{' },
      { type: 'Token', value: '}' }
    ])
    const { matched, done, value } = p(s)
    deepStrictEqual({ matched, done, value }, {
      matched: true,
      done: true,
      value: {
        type: 'ObjectPattern',
        keys: []
      }
    })
  })

  it('can parse an object with a key', () => {
    const p = ObjectPattern
    const s = Scope.From([
      { type: 'Token', value: '{' },
      { type: 'Identifier', value: 'x' },
      { type: 'Token', value: '}' }
    ])
    const { matched, done, value } = p(s)
    deepStrictEqual({ matched, done, value }, {
      matched: true,
      done: true,
      value: {
        type: 'ObjectPattern',
        keys: [
          {
            type: 'ObjectKeyPattern',
            name: 'x'
          }
        ]
      }
    })
  })

  it('can parse an object with a variable key', () => {
    const p = ObjectPattern
    const s = Scope.From([
      { type: 'Token', value: '{' },
      { type: 'Identifier', value: 'x' },
      { type: 'Token', value: ':' },
      { type: 'Identifier', value: 'y' },
      { type: 'Token', value: '}' }
    ])
    const { matched, done, value } = p(s)
    deepStrictEqual({ matched, done, value }, {
      matched: true,
      done: true,
      value: {
        type: 'ObjectPattern',
        keys: [
          {
            type: 'ObjectKeyPattern',
            name: 'y',
            pattern: {
              type: 'VariablePattern',
              name: 'x',
              pattern: {
                type: 'OkPattern'
              }
            }
          }
        ]
      }
    })
  })

  it('can parse an object with a pattern key', () => {
    const p = ObjectPattern
    const s = Scope.From([
      { type: 'Token', value: '{' },
      { type: 'Identifier', value: 'x' },
      { type: 'Token', value: ':' },
      { type: 'Identifier', value: 'y' },
      { type: 'Token', value: '=' },
      { type: 'Identifier', value: 'z' },
      { type: 'Token', value: '}' }
    ])
    const { matched, done, value } = p(s)
    deepStrictEqual({ matched, done, value }, {
      matched: true,
      done: true,
      value: {
        type: 'ObjectPattern',
        keys: [
          {
            type: 'ObjectKeyPattern',
            name: 'y',
            pattern: {
              type: 'VariablePattern',
              name: 'x',
              value: {
                type: 'ReferencePattern',
                value: 'z'
              }
            }
          }
        ]
      }
    })
  })

  it('can parse an object with a pattern key', () => {
    const p = ObjectPattern
    const s = Scope.From([
      { type: 'Token', value: '{' },
      { type: 'Identifier', value: 'x' },
      { type: 'Token', value: '=' },
      { type: 'Identifier', value: 'y' },
      { type: 'Token', value: '}' }
    ])
    const { matched, done, value } = p(s)
    deepStrictEqual({ matched, done, value }, {
      matched: true,
      done: true,
      value: {
        type: 'ObjectPattern',
        keys: [
          {
            type: 'ObjectKeyPattern',
            name: 'x',
            pattern: {
              type: 'ReferencePattern',
              value: 'y'
            }
          }
        ]
      }
    })
  })

  it('can parse an object with two pattern keys', () => {
    const p = ObjectPattern
    const s = Scope.From([
      { type: 'Token', value: '{' },
      { type: 'Identifier', value: 'a' },
      { type: 'Token', value: '=' },
      { type: 'Identifier', value: 'b' },
      { type: 'Token', value: ',' },
      { type: 'Identifier', value: 'x' },
      { type: 'Token', value: '=' },
      { type: 'Identifier', value: 'y' },
      { type: 'Token', value: '}' }
    ])
    const { matched, done, value } = p(s)
    deepStrictEqual({ matched, done, value }, {
      matched: true,
      done: true,
      value: {
        type: 'ObjectPattern',
        keys: [
          {
            type: 'ObjectKeyPattern',
            name: 'a',
            pattern: {
              type: 'ReferencePattern',
              value: 'b'
            }
          },
          {
            type: 'ObjectKeyPattern',
            name: 'x',
            pattern: {
              type: 'ReferencePattern',
              value: 'y'
            }
          }
        ]
      }
    })
  })
})
