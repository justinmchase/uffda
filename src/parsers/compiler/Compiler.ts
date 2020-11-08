import { any, rule, slice, projection, block } from '../../patterns'
import { Scope } from '../../scope'
import { PatternDeclaration } from './PatternDeclaration'

// Compiler = PatternDeclaration* -> block(_.reduce((a, b) => ({ })))

export const Compiler = (s: Scope) => {
  // console.log(s.stream.next().value)
  const p = rule({
    name: 'Compiler',
    pattern: projection({
      pattern: slice({
        pattern: PatternDeclaration
      }),
      expr: ({ _ }) => block(_.reduce((a, b) => ({ ...a, ...b }), {}))
    })
  })
  return p(s)
}
