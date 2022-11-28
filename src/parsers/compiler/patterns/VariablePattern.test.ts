import { tests } from "../../../test.ts";
import { PatternKind } from "../../../runtime/patterns/mod.ts";
import { VariablePattern } from "./VariablePattern.ts";
import { LangPatternKind } from "../../lang/lang.pattern.ts";

tests(() => [
  {
    id: "VARIABLEPATTERN00",
    description: "x:y",
    module: () => VariablePattern,
    input: [
      {
        kind: LangPatternKind.VariablePattern,
        name: "x",
        pattern: {
          kind: LangPatternKind.ReferencePattern,
          name: "y",
        },
      },
    ],
    value: {
      kind: PatternKind.Variable,
      name: "x",
      pattern: {
        kind: PatternKind.Reference,
        name: "y",
      },
    },
  },
]);
