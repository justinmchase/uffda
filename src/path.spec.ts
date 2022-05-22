// import { strictEqual } from 'assert'
// import { Path } from './path'

// describe('/path', () => {
//   describe('printing', () => {
//     it('default path is -1', () => {
//       const p = Path.Default()
//       strictEqual(p.toString(), '-1')
//     })
//     it('default path moved to -1', () => {
//       const p = Path.Default().moveTo(-1)
//       strictEqual(p.toString(), '-1')
//     })
//     it('default path moved to 0', () => {
//       const p = Path.Default().moveTo(0)
//       strictEqual(p.toString(), '0')
//     })
//     it('default path moved to x', () => {
//       const p = Path.Default().moveTo('x')
//       strictEqual(p.toString(), 'x')
//     })
//     it('-1 added to x', () => {
//       const p = Path.From('x').add(-1)
//       strictEqual(p.toString(), 'x.-1')
//     })
//     it('sub path moves', () => {
//       const p = Path.From('x').add('y').add('z').add(7).moveTo(11)
//       strictEqual(p.toString(), 'x.y.z.11')
//     })
//   })

//   describe('comparison', () => {
//     it('two default paths are equal', () => {
//       const p0 = Path.Default()
//       const p1 = Path.Default()
//       strictEqual(p0.compareTo(p1), 0)
//     })

//     it('two paths at same index are equal', () => {
//       const p0 = Path.From(-1)
//       const p1 = Path.From(-1)
//       strictEqual(p0.compareTo(p1), 0)
//     })

//     it('two string paths at same index are equal', () => {
//       const p0 = Path.From('x')
//       const p1 = Path.From('x')
//       strictEqual(p0.compareTo(p1), 0)
//     })

//     it('a numeric segment is lt a string segment', () => {
//       const p0 = Path.From(0)
//       const p1 = Path.From('x')
//       strictEqual(p0.compareTo(p1), -1)
//     })

//     it('a string segment is gt a numeric segment', () => {
//       const p0 = Path.From('x')
//       const p1 = Path.From(0)
//       strictEqual(p0.compareTo(p1), 1)
//     })

//     it('lt numerics', () => {
//       const p0 = Path.From(0)
//       const p1 = Path.From(1)
//       strictEqual(p0.compareTo(p1), -1)
//     })

//     it('gt numerics', () => {
//       const p0 = Path.From(1)
//       const p1 = Path.From(0)
//       strictEqual(p0.compareTo(p1), 1)
//     })

//     it('lt strings', () => {
//       const p0 = Path.From('a')
//       const p1 = Path.From('b')
//       strictEqual(p0.compareTo(p1), -1)
//     })

//     it('gt strings', () => {
//       const p0 = Path.From('b')
//       const p1 = Path.From('a')
//       strictEqual(p0.compareTo(p1), 1)
//     })

//     const deepLtData = [
//       [new Path([0, 0, 0]), new Path([1, 0, 0])],
//       [new Path([0, 0, 0]), new Path([0, 1, 0])],
//       [new Path([0, 0, 0]), new Path([0, 0, 1])],
//       [new Path([0, 0, 0]), new Path(['x', 0, 0])],
//       [new Path([0, 0, 0]), new Path([0, 'x', 0])],
//       [new Path([0, 0, 0]), new Path([0, 0, 'x'])],
//     ]
//     deepLtData.forEach(([p0, p1]) => {
//       it(`${p0} < ${p1}`, () => {
//         strictEqual(p0.compareTo(p1), -1)
//       })
//     })

//     const deepGtData = [
//       [new Path([1, 0, 0]), new Path([0, 0, 0])],
//       [new Path([0, 1, 0]), new Path([0, 0, 0])],
//       [new Path([0, 0, 1]), new Path([0, 0, 0])],
//       [new Path(['x', 0, 0]), new Path([0, 0, 0])],
//       [new Path([0, 'x', 0]), new Path([0, 0, 0])],
//       [new Path([0, 0, 'x']), new Path([0, 0, 0])],
//     ]
//     deepGtData.forEach(([p0, p1]) => {
//       it(`${p0} > ${p1}`, () => {
//         strictEqual(p0.compareTo(p1), 1)
//       })
//     })
//   })
// })
