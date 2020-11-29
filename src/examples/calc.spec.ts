import { strictEqual } from 'assert'
import { calc2 } from './calc'

// describe('/examples/calc', () => {
//   it('add two numbers', () => {
//     const result = calc`7+11`
//     strictEqual(result, 18)
//   })
// })

describe('/examples/calc2', () => {
  it('add two numbers', () => {
    const result = calc2`7 + 11`
    strictEqual(result, 18)
  })
})
