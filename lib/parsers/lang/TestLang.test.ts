import { IRulePattern, PatternKind } from "../../runtime/patterns/mod.ts";
import { Basic, Lang } from "../mod.ts";

export const TestLang: IRulePattern = {
  kind: PatternKind.Rule,
  pattern: {
    kind: PatternKind.Block,
    rules: {
      Basic,
      Lang,
      Main: {
        kind: PatternKind.Rule,
        pattern: {
          kind: PatternKind.Pipeline,
          steps: [
            { kind: PatternKind.Reference, name: "Basic" },
            { kind: PatternKind.Reference, name: "Lang" },
          ],
        },
      },
    },
  },
};
