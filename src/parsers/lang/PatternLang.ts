import { IRulePattern, PatternKind } from "../../runtime/mod.ts";
import { Basic } from "../../mod.ts";
import * as Patterns from "./patterns/mod.ts";
import * as Expressions from "./expressions/mod.ts";
import { LangPatternKind } from "./lang.pattern.ts";

export const PatternLang: IRulePattern = {
  kind: PatternKind.Rule,
  pattern: {
    kind: PatternKind.Block,
    rules: {
      Basic,
      ...Patterns,
      ...Expressions,
      Main: {
        kind: PatternKind.Rule,
        pattern: {
          kind: PatternKind.Pipeline,
          steps: [
            { kind: PatternKind.Reference, name: "Basic" },
            {
              kind: PatternKind.Reference,
              name: LangPatternKind.PatternPattern,
            },
          ],
        },
      },
    },
  },
};
