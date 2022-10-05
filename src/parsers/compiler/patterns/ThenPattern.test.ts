import { tests } from "../../../test.ts";
import { PatternKind } from "../../../runtime/patterns/mod.ts";
import { PatternCompiler } from "../PatternCompiler.ts";

tests(() => [
  {
    id: "THENPATTERN00",
    description: "a b",
    pattern: () => PatternCompiler,
    input: "x y",
    value: {
      kind: PatternKind.Then,
      patterns: [
        {
          kind: PatternKind.Reference,
          name: "x",
        },
        {
          kind: PatternKind.Reference,
          name: "y",
        },
      ],
    },
  },
]);
