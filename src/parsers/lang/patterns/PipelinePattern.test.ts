import { tests } from "../../../test.ts";
import { PatternLang } from "../PatternLang.ts";
import { LangPatternKind } from "../lang.pattern.ts";

tests(() => [
  {
    id: "PIPELINE00",
    description: "it can pipe two steps",
    pattern: () => PatternLang,
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
