import { Pattern, PatternKind } from '../../runtime/patterns/mod.ts'


export const Token: Pattern = {
  kind: PatternKind.RegExp,
  pattern: /^[^\w\d\s]$/
}
