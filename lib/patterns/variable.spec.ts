// import { deepStrictEqual } from 'assert'
// import { Scope } from '../scope'
// import { any } from './any'
// import { object } from './object'
// import { projection } from './projection'
// import { then } from './then'
// import { variable } from './variable'

// describe('/patterns/variable', () => {
//   it('should be available in projection of same scope', () => {
//     // P = x:any -> x + 11
//     const p = projection({
//       pattern: variable({
//         name: 'x',
//         pattern: any
//       }),
//       expr: ({ x }) => x + 11
//     })
//     const s = Scope.From([7])
//     const { matched, done, value } = p(s)
//     deepStrictEqual({ matched, done, value }, {
//       matched: true,
//       done: true,
//       value: 18
//     })
//   })

//   it('multiple variables should be available in projection of same scope', () => {
//     // P = x:any y:any -> x + y
//     const p = projection({
//       pattern: then({
//         patterns: [
//           variable({
//             name: 'x',
//             pattern: any
//           }),
//           variable({
//             name: 'y',
//             pattern: any
//           }),
//         ]
//       }),
//       expr: ({ x, y }) => x + y
//     })
//     const s = Scope.From([7, 11])
//     const { matched, done, value } = p(s)
//     deepStrictEqual({ matched, done, value }, {
//       matched: true,
//       done: true,
//       value: 18
//     })
//   })

//   it('variables on object keys should be available', () => {
//     // P = { x:X, y:Y } -> x + y
//     const p = projection({
//       pattern: object({
//         keys: {
//           X: variable({
//             name: 'x',
//             pattern: any,
//           }),
//           Y: variable({
//             name: 'y',
//             pattern: any
//           })
//         }
//       }),
//       expr: ({ x, y }) => x + y
//     })
//     const s = Scope.From([{ X: 7, Y: 11 }])
//     const { matched, done, value } = p(s)
//     deepStrictEqual({ matched, done, value }, {
//       matched: true,
//       done: true,
//       value: 18
//     })
//   })


//   it('variables in object key pattern should be available', () => {
//     // P = { X = x:any, Y = y:any } -> x + y
//     const p = projection({
//       pattern: object({
//         keys: {
//           X: variable({
//             name: 'x',
//             pattern: any
//           }),
//           Y: variable({
//             name: 'y',
//             pattern: any
//           }),
//         }
//       }),
//       expr: ({ x, y }) => x + y
//     })
//     const s = Scope.From([{ X: 7, Y: 11 }])
//     const { matched, done, value } = p(s)
//     deepStrictEqual({ matched, done, value }, {
//       matched: true,
//       done: true,
//       value: 18
//     })
//   })

//   // todo: variable name colision should probably be an error
// })
