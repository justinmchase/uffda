import { Pattern, rule, slice, projection, block } from '../../patterns/mod.ts'
import { Scope } from '../../scope.ts'
import { PatternDeclaration } from './PatternDeclaration.ts'

// Compiler = PatternDeclaration* -> block(_.reduce((a, b) => ({ })))

export const Compiler = (s: Scope) => {
  // console.log(s.stream.next().value)
  const p = rule({
    name: 'Compiler',
    pattern: projection({
      pattern: slice({
        pattern: PatternDeclaration
      }),
      expr: ({ _ }: { _: Record<string, Pattern>[]}) => block(_.reduce((a, b) => ({ ...a, ...b }), {}))
    })
  })
  return p(s)
}
