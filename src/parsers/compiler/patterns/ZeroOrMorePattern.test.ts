import { tests } from "../../../test.ts";
import { PatternKind } from "../../../runtime/patterns/mod.ts";
import { PatternCompiler } from "../PatternCompiler.ts";

tests(() => [
  {
    id: "ZEROORMORE00",
    description: "x*",
    pattern: () => PatternCompiler,
    input: "x*",
    value: {
      kind: PatternKind.Slice,
      min: 0,
      pattern: {
        kind: PatternKind.Reference,
        name: "x",
      },
    },
  },
]);
