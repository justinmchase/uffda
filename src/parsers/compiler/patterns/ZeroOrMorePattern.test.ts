import { tests } from "../../../test.ts";
import { PatternKind } from "../../../runtime/patterns/mod.ts";
import { ZeroOrMorePattern } from "./ZeroOrMorePattern.ts";
import { LangPatternKind } from "../../lang/lang.pattern.ts";

tests(() => [
  {
    id: "ZEROORMORE00",
    description: "x*",
    module: () => ZeroOrMorePattern,
    // input: "x*",
    input: [
      {
        kind: LangPatternKind.ZeroOrMorePattern,
        pattern: {
          kind: LangPatternKind.ReferencePattern,
          name: "x",
        },
      },
    ],
    value: {
      kind: PatternKind.Slice,
      min: 0,
      pattern: {
        kind: PatternKind.Reference,
        name: "x",
      },
    },
  },
]);
