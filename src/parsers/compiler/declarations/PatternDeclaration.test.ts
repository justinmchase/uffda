import { tests } from "../../../test.ts";
import { PatternKind } from "../../../runtime/patterns/mod.ts";
import { Compiler } from "../Compiler.ts";

tests(() => [
  {
    id: "PATTERNDECLARATION00",
    pattern: () => Compiler,
    input: "X = ok;",
    value: {
      kind: PatternKind.Block,
      rules: {
        X: {
          kind: PatternKind.Rule,
          pattern: {
            kind: PatternKind.Ok,
          },
        },
      },
    },
  },
]);
