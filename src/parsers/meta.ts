import { Pattern, PatternKind } from "../runtime/patterns/mod.ts";
import { Lang } from "./lang/Lang.ts";
import { Compiler } from "./compiler/Compiler.ts";

export const Meta: Pattern = {
  kind: PatternKind.Block,
  rules: {
    Lang,
    Compiler,
    Main: {
      kind: PatternKind.Rule,
      pattern: {
        kind: PatternKind.Pipeline,
        steps: [
          { kind: PatternKind.Reference, name: "Lang" },
          { kind: PatternKind.Reference, name: "Compiler" },
        ],
      },
    },
  },
};
