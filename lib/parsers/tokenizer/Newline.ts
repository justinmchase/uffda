import { equal, or, projection, then } from '../../patterns/mod.ts'

export const Newline = or({
  patterns: [
    equal({ value: '\n' }),
    projection({
      pattern: then({
        patterns: [
          equal({ value: '\r' }),
          equal({ value: '\n' })
        ]
      }),
      expr: () => '\r\n'
    }),
    equal({ value: '\r' })
  ]
})
