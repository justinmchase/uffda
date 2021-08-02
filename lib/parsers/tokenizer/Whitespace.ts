import { projection, regexp, slice } from '../../patterns/mod.ts'

export const Whitespace = projection({
  pattern: slice({
    min: 1,
    pattern: regexp({
      pattern: /[^\S\r\n]/
    })
  }),
  expr: ({ _ }: { _: string[] }) => _.join('')
})
