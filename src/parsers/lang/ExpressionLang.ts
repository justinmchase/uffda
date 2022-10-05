import { IRulePattern, PatternKind } from "../../runtime/mod.ts";
import { Basic } from "../../mod.ts";
import { LangPatternKind } from "./lang.pattern.ts";
import { ExpressionPattern } from "./patterns/mod.ts";
import * as Expressions from "./expressions/mod.ts";

export const ExpressionLang: IRulePattern = {
  kind: PatternKind.Rule,
  pattern: {
    kind: PatternKind.Block,
    rules: {
      Basic,
      ExpressionPattern,
      ...Expressions,
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
