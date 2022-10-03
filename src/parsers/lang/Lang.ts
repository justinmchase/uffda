import { IRulePattern, PatternKind } from "../../runtime/patterns/mod.ts";
import { LangModuleKind } from "./lang.pattern.ts";
import { Basic } from "../basic.ts";
import { PatternModule } from "./PatternModule.ts"; 
import * as Declarations from "./declarations/mod.ts";
import * as Patterns from "./patterns/mod.ts";
import * as Expressions from "./expressions/mod.ts";

export const Lang: IRulePattern = {
  kind: PatternKind.Rule,
  pattern: {
    kind: PatternKind.Block,
    rules: {
      Basic,
      PatternModule,
      ...Declarations,
      ...Patterns,
      ...Expressions,
      Main: {
        kind: PatternKind.Rule,
        pattern: {
          kind: PatternKind.Pipeline,
          steps: [
            { kind: PatternKind.Reference, name: "Basic" },
            { kind: PatternKind.Reference, name: LangModuleKind.PatternModule },
          ],
        },
      },
    },
  },
};
