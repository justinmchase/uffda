import { tests } from "../../../test.ts";
import { PatternKind } from "../../../runtime/patterns/mod.ts";
import { OneOrMorePattern } from "./OneOrMorePattern.ts";
import { LangPatternKind } from "../../lang/lang.pattern.ts";

tests(() => [
  {
    id: "ONEORMOREPATTERN00",
    description: "a+",
    module: () => OneOrMorePattern,
    input: [
      {
        kind: LangPatternKind.OneOrMorePattern,
        pattern: {
          kind: LangPatternKind.ReferencePattern,
          name: "a"
        }
      }
    ],
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
