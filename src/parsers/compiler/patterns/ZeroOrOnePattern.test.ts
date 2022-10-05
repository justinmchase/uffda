import { tests } from "../../../test.ts";
import { PatternKind } from "../../../runtime/patterns/mod.ts";
import { PatternCompiler } from "../PatternCompiler.ts";

tests(() => [
  {
    id: "ZEROORONE00",
    pattern: () => PatternCompiler,
    input: "x?",
    value: {
      kind: PatternKind.Slice,
      min: 0,
      max: 1,
      pattern: {
        kind: PatternKind.Reference,
        name: "x",
      },
    },
  },
]);
