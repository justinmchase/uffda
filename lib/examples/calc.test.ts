import { assert } from '../../deps/std.ts'
// import { calc } from './calc.js'

// Deno.test({
//   name: 'CALC00',
//   fn: async () => {
//     const { calc } = await import('./calc.js')

//     console.log(Deno.inspect(calc, { colors: true }))
//     // const result = calc`7 + 11`
//     // console.log(result)
//     // assert(result === 18, `Expected 18 got ${result}`)
//   }
// })

// describe('/examples/calc2', () => {
//   it('add two numbers', () => {
//     const result = calc`7 + 11`
//     strictEqual(result, 18)
//   })
//   it('can add three numbers', () => {
//     const result = calc`7 + 11 + 100`
//     strictEqual(result, 118)
//   })
//   it('can sub two numbers', () => {
//     const result = calc`11 - 7`
//     strictEqual(result, 4)
//   })
//   it('can sub three numbers', () => {
//     const result = calc`3 - 2 - 1`
//     strictEqual(result, 0)
//   })
//   it('sub has correct precedence', () => {
//     const result = calc`1 + 2 - 3 + 4`
//     strictEqual(result, 4)
//   })
// })
