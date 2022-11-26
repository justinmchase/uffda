import { tests } from "../../../test.ts";
import { PatternKind } from "../../../runtime/patterns/mod.ts";
import { OrPattern } from "./OrPattern.ts";
import { LangPatternKind } from "../../lang/lang.pattern.ts";

tests(() => [
  {
    id: "ORPATTERN00",
    description: "a | b",
    module: () => OrPattern,
    input: [
      {
        kind: LangPatternKind.OrPattern,
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
