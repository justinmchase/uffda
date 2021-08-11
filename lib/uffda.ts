import { assert } from "../deps/std.ts"
import { Scope } from './scope.ts'
import { Meta } from './parsers/mod.ts'
import { Pattern, match } from './runtime/mod.ts'

export function uffda(args: TemplateStringsArray, ...values: unknown[]) {
  let uffdaCode = ''
  for (let i = 0, n = args.length; i < n; i++) {
    const a = args[i]
    uffdaCode += a
    if (i < values.length) {
      uffdaCode += `$${i}`
    }
  }

  const variables = values.reduce((a, b, i) => Object.assign(a, { [`$${i}`]: b }), {}) as Record<string, unknown>
  const scope = Scope
    .From(uffdaCode)
    .setSpeical(variables)
    .push()

  const { matched, done, value: ast } = match(Meta, scope)
  assert(matched)
  assert(done)
  assert(ast)
  return function dsl(args: TemplateStringsArray, ...values: unknown[]) {
    let dslCode = ''
    for (let i = 0, n = args.length; i < n; i++) {
      const a = args[i]
      dslCode += a
      if (i < values.length) {
        dslCode += `$${i}`
      }
    }

    const variables = values.reduce((a, b, i) => Object.assign(a, { [`$${i}`]: b }), {}) as Record<string, unknown>
    const scope = Scope
      .From(dslCode)
      .setSpeical(variables)

    const { matched, done, value: result } = match(ast as Pattern, scope)
    assert(matched)
    assert(done)
    assert(result)

    return result
  }
}
