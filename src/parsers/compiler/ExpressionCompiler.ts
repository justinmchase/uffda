import { IRulePattern, PatternKind } from "../../runtime/mod.ts";
import { ExpressionLang } from "../lang/ExpressionLang.ts";
import { ExpressionPattern } from "./patterns/mod.ts";
import * as Expressions from "./expressions/mod.ts"

export const ExpressionCompiler: IRulePattern = {
  kind: PatternKind.Rule,
  pattern: {
    kind: PatternKind.Block,
    rules: {
      ExpressionLang,
      ExpressionPattern,
      ...Expressions,
      Main: {
        kind: PatternKind.Rule,
        pattern: {
          kind: PatternKind.Pipeline,
          steps: [
            { kind: PatternKind.Reference, name: "ExpressionLang" },
            { kind: PatternKind.Reference, name: "ExpressionPattern" },
          ],
        },
      },
    },
  },
};
