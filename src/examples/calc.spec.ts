import { strictEqual } from 'assert'
import { calc } from './calc'

describe('/examples/calc', () => {
  it('add two numbers', () => {
    const result = calc`7+11`
    strictEqual(result, 18)
  })
})
