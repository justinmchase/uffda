import { IRulePattern, PatternKind } from "../../runtime/patterns/mod.ts";
import { Lang } from "../lang/Lang.ts";
import { PatternModule } from "./PatternModule.ts"; 
import * as Declarations from "./declarations/mod.ts";
import * as Patterns from "./patterns/mod.ts";
import * as Expressions from "./expressions/mod.ts";

export const Compiler: IRulePattern = {
  kind: PatternKind.Rule,
  pattern: {
    kind: PatternKind.Block,
    rules: {
      Lang,
      ...Patterns,
      ...Expressions,
      ...Declarations,
      PatternModule,
      Main: {
        kind: PatternKind.Rule,
        pattern: {
          kind: PatternKind.Pipeline,
          steps: [
            { kind: PatternKind.Reference, name: "Lang" },
            { kind: PatternKind.Reference, name: "PatternModule" },
          ],
        },
      }
    }
  }
};