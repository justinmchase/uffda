import { tests } from "../../../test.ts";
import { PatternKind } from "../../../runtime/patterns/mod.ts";
import { PatternCompiler } from "../PatternCompiler.ts";

tests(() => [
  {
    id: "ORPATTERN00",
    description: "a | b",
    pattern: () => PatternCompiler,
    input: "a | b",
    value: {
      kind: PatternKind.Or,
      patterns: [
        {
          kind: PatternKind.Reference,
          name: "a",
        },
        {
          kind: PatternKind.Reference,
          name: "b",
        },
      ],
    },
  },
]);
