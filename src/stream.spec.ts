import { strictEqual, throws } from 'assert'
import { MetaStream } from './stream'

describe('/stream', () => {
  it('empty stream is done', () => {
    const s = MetaStream.Default()
    strictEqual(s.done, true)
  })

  it('a stream with more content is not done', () => {
    const s = MetaStream.From('a')
    strictEqual(s.done, false)
  })

  it('value is undefined at index -1', () => {
    const s = MetaStream.Default()
    strictEqual(s.value, undefined)
  })

  it('gets correct value after next', () => {
    const s0 = MetaStream.From('a')
    const s1 = s0.next()
    strictEqual(s1.value, 'a')
  })

  it('is done after next', () => {
    const s0 = MetaStream.From('a')
    const s1 = s0.next()
    strictEqual(s1.done, true)
  })

  it('is not done after next with longer string', () => {
    const s0 = MetaStream.From('abc')
    const s1 = s0.next()
    strictEqual(s1.done, false)
  })

  it('has correct initial path', () => {
    const s0 = MetaStream.Default()
    strictEqual(s0.path.toString(), '-1')
  })

  it('has correct path after next', () => {
    const s0 = MetaStream.From('a')
    const s1 = s0.next()
    strictEqual(s1.path.toString(), '0')
  })

  it('has correct path after multiple nexts', () => {
    const s0 = MetaStream.From('aaa')
    const s1 = s0.next().next().next()
    strictEqual(s1.path.toString(), '2')
  })

  it('next at end of stream returns self', () => {
    const s0 = MetaStream.From('a')
    const s1 = s0.next().next()
    strictEqual(s1.path.toString(), '0')
  })
})
