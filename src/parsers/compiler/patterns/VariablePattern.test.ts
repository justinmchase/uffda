import { tests } from "../../../test.ts";
import { PatternKind } from "../../../runtime/patterns/mod.ts";
import { PatternCompiler } from "../PatternCompiler.ts";

tests(() => [
  {
    id: "VARIABLEPATTERN00",
    description: "x:y",
    pattern: () => PatternCompiler,
    input: "x:y",
    value: {
      kind: PatternKind.Variable,
      name: "x",
      pattern: {
        kind: PatternKind.Reference,
        name: "y",
      },
    },
  },
]);
