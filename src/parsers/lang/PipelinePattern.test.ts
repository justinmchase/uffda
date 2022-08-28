import { tests } from "../../test.ts";
import { TestLang } from "./TestLang.test.ts";
import { LangPatternKind } from "./lang.pattern.ts";

tests(import.meta.url, () => [
  {
    id: "PIPELINE00",
    description: "it can pipe two steps",
    pattern: () => TestLang,
    input: "x > y",
    value: {
      kind: LangPatternKind.PipelinePattern,
      left: {
        kind: LangPatternKind.ReferencePattern,
        name: "x",
      },
      right: {
        kind: LangPatternKind.ReferencePattern,
        name: "y",
      },
    },
  },
]);
