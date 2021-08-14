import { tests } from "../../test.ts";
import { Meta } from "../meta.ts";
import { PatternKind } from "../../runtime/patterns/mod.ts";

tests("parsers.compiler.variablepattern", () => [
  {
    id: "VARIABLEPATTERN00",
    description: "x:y",
    pattern: () => Meta,
    input: "x:y",
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
