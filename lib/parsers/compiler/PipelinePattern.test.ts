import { tests } from "../../test.ts";
import { Meta } from "../meta.ts";
import { PatternKind } from "../../runtime/patterns/mod.ts";

tests(import.meta.url, () => [
  {
    id: "PIPELINEPATTERN00",
    description: "a > b",
    pattern: () => Meta,
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
