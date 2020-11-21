import { assert } from 'console'
import { Scope } from './scope'
import { meta } from './parsers'

export function uffda(args: TemplateStringsArray, ...values: any[]) {
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

  console.log('--')
  console.log('UFFDA CODE:', { uffdaCode, variables })

  const { matched, done, value: compiledDsl } = meta(scope)
  console.log('RESULT', {
    matched,
    done,
    compiledDsl
  })

  assert(matched)
  assert(done)
  assert(compiledDsl)
  return function dsl(args: TemplateStringsArray, ...values: any[]) {
    let dslCode = ''
    for (let i = 0, n = args.length; i < n; i++) {
      const a = args[i]
      dslCode += a
      if (i < values.length) {
        dslCode += `$${i}`
      }
    }

    const variables = values.reduce((a, b, i) => Object.assign(a, { [`$${i}`]: b }), {})
    console.log('--')
    console.log('DSL CODE:', { dslCode, variables })
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
