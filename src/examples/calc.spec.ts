import { strictEqual } from 'assert'
import { calc } from './calc'

describe('/examples/calc', () => {
  it('add two numbers', () => {
    const result = calc`1+2`
    strictEqual(result, 3)
  })
})
