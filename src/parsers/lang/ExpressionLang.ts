import { IRulePattern, PatternKind } from "../../runtime/patterns/mod.ts";
import { Basic } from "../../mod.ts";
import { LangPatternKind } from "./lang.pattern.ts";
import * as Expressions from "./expressions/mod.ts";
import * as Patterns from "./patterns/mod.ts";

export const ExpressionLang: IRulePattern = {
  kind: PatternKind.Rule,
  pattern: {
    kind: PatternKind.Block,
    rules: {
      Basic,
      ...Expressions,
      ...Patterns,
      Main: {
        kind: PatternKind.Rule,
        pattern: {
          kind: PatternKind.Pipeline,
          steps: [
            { kind: PatternKind.Reference, name: "Basic" },
            {
              kind: PatternKind.Reference,
              name: LangPatternKind.ExpressionPattern,
            },
          ],
        },
      },
    },
  },
};
