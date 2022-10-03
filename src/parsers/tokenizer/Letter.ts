import { Pattern, PatternKind } from "../../runtime/patterns/mod.ts";

export const Letter: Pattern = {
  kind: PatternKind.RegExp,
  pattern: /_|\p{L}/u,
};
