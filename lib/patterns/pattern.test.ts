import { assert, assertThrows, equal, brightCyan, brightMagenta, brightBlack } from "../../deps/std.ts"
import { Scope } from '../scope.ts'
import { Pattern } from './pattern.ts'

interface IPatternTest {
  id: string
  description: string
  pattern: () => Pattern
}

interface IPatternThrows {
  throws: true
}

interface IPatternMatches {
  throws?: false
  input: Iterable<unknown> | Scope
  value?: unknown
  matched?: boolean
  done?: boolean
}

type PatternTest = IPatternTest & (
  IPatternThrows |
  IPatternMatches
)

export function tests(testGroupName: string, group: () => PatternTest[]) {
  const tests = group()
  for (const test of tests) {
    const { id, description, pattern } = test
    Deno.test({
      name: `${brightCyan(testGroupName)} [${brightMagenta(id)}] (${brightBlack(description)})`,
      fn: () => {
        if (test.throws) {
          assertThrows(pattern, undefined, undefined, `Pattern was expected to throw during construction`)
        } else {
          const { input, value, matched = true, done = true } = test
          const p = pattern()
          const s = Scope.From(input)
          const m = p(s)
          assert(equal(m.value, value), `Pattern value ${m.value} was expected to be ${value}`)
          assert(equal(m.matched, matched), `Pattern was ${matched ? '' : 'not '}expected to match`)
          assert(equal(m.done, done), `Pattern was ${done ? '' : 'not '}expected to be done`)
        }
      }
    })
  }
}
