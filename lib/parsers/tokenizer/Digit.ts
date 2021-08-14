import { Pattern, PatternKind } from "../../runtime/patterns/mod.ts";

export const Digit: Pattern = {
  kind: PatternKind.RegExp,
  pattern: /[0-9]/,
};
