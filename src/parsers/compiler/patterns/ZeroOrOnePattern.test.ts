import { tests } from "../../../test.ts";
import { PatternKind } from "../../../runtime/patterns/mod.ts";
import { ZeroOrOnePattern } from "./ZeroOrOnePattern.ts";
import { LangPatternKind } from "../../lang/lang.pattern.ts";

tests(() => [
  {
    id: "ZEROORONE00",
    description: "x?",
    module: () => ZeroOrOnePattern,
    input: [
      {
        kind: LangPatternKind.ZeroOrOnePattern,
        pattern: {
          kind: LangPatternKind.ReferencePattern,
          name: "x",
        },
      },
    ],
    value: {
      kind: PatternKind.Slice,
      min: 0,
      max: 1,
      pattern: {
        kind: PatternKind.Reference,
        name: "x",
      },
    },
  },
]);
