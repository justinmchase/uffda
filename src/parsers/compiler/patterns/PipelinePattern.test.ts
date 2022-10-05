import { tests } from "../../../test.ts";
import { PatternKind } from "../../../runtime/patterns/mod.ts";
import { PatternCompiler } from "../PatternCompiler.ts";

tests(() => [
  {
    id: "PIPELINEPATTERN00",
    description: "a > b",
    pattern: () => PatternCompiler,
    input: "a > b",
    value: {
      kind: PatternKind.Pipeline,
      steps: [
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
