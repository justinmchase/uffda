import { tests } from "../../test.ts";
import { Meta } from "../meta.ts";
import { PatternKind } from "../../runtime/patterns/mod.ts";

tests("parsers.compiler.referencepattern", () => [
  {
    id: "REFERENCE00",
    description: "a",
    pattern: () => Meta,
    input: "a",
    value: {
      kind: PatternKind.Reference,
      name: "a",
    },
  },
]);
