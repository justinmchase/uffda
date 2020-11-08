import { Stream } from 'stream'
import { assert } from 'console'
import { MetaStream } from './stream'
import { Scope } from './scope'
import { meta } from './parsers'

export function jbang(args: TemplateStringsArray, ...values: any[]) {
  let jbangCode = ''
  for (let i = 0, n = args.length; i < n; i++) {
    const a = args[i]
    jbangCode += a
    if (i < values.length) {
      jbangCode += `$${i}`
    }
  }

  const variables = values.reduce((a, b, i) => Object.assign(a, { [`$${i}`]: b }), {})
  const scope = Scope
    .From(jbangCode)
    .setVariables(variables)
    .push()

  console.log('--')
  console.log('JBANG CODE:', { jbangCode, variables })

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
