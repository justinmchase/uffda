import { tests } from "../../test.ts";
import { Meta } from "../meta.ts";
import { PatternKind } from "../../runtime/patterns/mod.ts";

tests("parsers.compiler.patterndeclaration", () => [
  {
    id: "PATTERNDECLARATION00",
    description: "X = ok",
    pattern: () => Meta,
    input: "X = ok;",
    value: {
      kind: PatternKind.Block,
      variables: {
        X: {
          kind: PatternKind.Rule,
          pattern: {
            kind: PatternKind.Ok,
          },
        },
      },
    },
  },
]);
