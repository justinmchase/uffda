import { Stream } from 'stream'
import { MetaStream } from './stream'
import { Scope } from './scope'
import { meta } from './parsers'

export function jbang(args: TemplateStringsArray, ...values: any[]) {
  let code = ''
  const projections = {}
  for (let i = 0, n = args.length; i < n; i++) {
    const a = args[i]
    const v = values[i]
    if (typeof v === 'function') {
      const name = `P${i}`
      projections[name] = v
      code = `${code}${a}${name}`
    } else if (v == null) {
      code = `${code}${a}`
    } else {
      code = `${code}${a}${v}`
    }
  }

  const scope = Scope
    .From(code)
    .addProjections(projections)

  const { matched, done, value } = meta(scope)

  console.log('RESULT:', JSON.stringify({
    matched,
    done,
    value
  }, null, 2))

  return function dsl(code: TemplateStringsArray, ...values: any[]) {

    return {
      matched,
      value
    }
  }
}
