import { tests } from "../../../test.ts";
import { PatternKind } from "../../../runtime/patterns/mod.ts";
import { PipelinePattern } from "./PipelinePattern.ts";
import { LangPatternKind } from "../../lang/lang.pattern.ts";

tests(() => [
  {
    id: "PIPELINEPATTERN00",
    description: "a > b",
    module: () => PipelinePattern,
    input: [
      {
        kind: LangPatternKind.PipelinePattern,
        left: {
          kind: LangPatternKind.ReferencePattern,
          name: "a"
        },
        right: {
          kind: LangPatternKind.ReferencePattern,
          name: "b"
        }
      }
    ],
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
