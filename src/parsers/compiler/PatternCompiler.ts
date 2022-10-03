import { IRulePattern, PatternKind } from "../../runtime/mod.ts";
import { PatternLang } from "../lang/PatternLang.ts";
import * as Patterns from "./patterns/mod.ts";
import * as Expressions from "./expressions/mod.ts";

export const PatternCompiler: IRulePattern = {
  kind: PatternKind.Rule,
  pattern: {
    kind: PatternKind.Block,
    rules: {
      PatternLang,
      ...Patterns,
      ...Expressions,
      Main: {
        kind: PatternKind.Rule,
        pattern: {
          kind: PatternKind.Pipeline,
          steps: [
            { kind: PatternKind.Reference, name: "PatternLang" },
            { kind: PatternKind.Reference, name: "PatternPattern" },
          ],
        },
      },
    },
  },
};
