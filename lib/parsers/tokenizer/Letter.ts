import { Pattern, PatternKind } from '../../runtime/patterns/mod.ts'

export const Letter: Pattern = {
  kind: PatternKind.RegExp,
  pattern: /\p{L}/u
}
