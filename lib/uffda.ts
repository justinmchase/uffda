import { assert } from "../deps/std.ts"
import { Scope } from './scope.ts'
import { meta } from './parsers/mod.ts'

export function uffda(args: TemplateStringsArray, ...values: unknown[]) {
  let uffdaCode = ''
  for (let i = 0, n = args.length; i < n; i++) {
    const a = args[i]
    uffdaCode += a
    if (i < values.length) {
      uffdaCode += `$${i}`
    }
  }

  const variables = values.reduce((a, b, i) => Object.assign(a, { [`$${i}`]: b }), {})
  const scope = Scope
    .From(uffdaCode)
    .setVariables(variables)
    .push()

  const { matched, done, value: compiledDsl } = meta(scope)
  assert(matched)
  assert(done)
  assert(compiledDsl)
  return function dsl(args: TemplateStringsArray, ...values: unknown[]) {
    let dslCode = ''
    for (let i = 0, n = args.length; i < n; i++) {
      const a = args[i]
      dslCode += a
      if (i < values.length) {
        dslCode += `$${i}`
      }
    }

    const variables = values.reduce((a, b, i) => Object.assign(a, { [`$${i}`]: b }), {})
    const scope = Scope
      .From(dslCode)
      .setVariables(variables)

    const { matched, done, value: result } = compiledDsl(scope)
    assert(matched)
    assert(done)
    assert(result)

    return result
  }
}
