import { tests } from "../../../test.ts";
import { PatternKind } from "../../../runtime/patterns/mod.ts";
import { PatternCompiler } from "../PatternCompiler.ts";

tests(() => [
  {
    id: "ONEORMOREPATTERN00",
    description: "a+",
    pattern: () => PatternCompiler,
    input: "a+",
    value: {
      kind: PatternKind.Slice,
      min: 1,
      pattern: {
        kind: PatternKind.Reference,
        name: "a",
      },
    },
  },
]);
