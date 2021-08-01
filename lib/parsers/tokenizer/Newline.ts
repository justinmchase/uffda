import { equal, or, projection, then } from '../../patterns'

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
