import { tests } from "../../../test.ts";
import { PatternKind } from "../../../runtime/patterns/mod.ts";
import { ThenPattern } from "./ThenPattern.ts";
import { LangPatternKind } from "../../lang/lang.pattern.ts";

tests(() => [
  {
    id: "THENPATTERN00",
    description: "x y",
    module: () => ThenPattern,
    input: [
      {
        kind: LangPatternKind.ThenPattern,
        left: { kind: LangPatternKind.ReferencePattern, name: "x" },
        right: { kind: LangPatternKind.ReferencePattern, name: "y" },
      }
    ],
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
