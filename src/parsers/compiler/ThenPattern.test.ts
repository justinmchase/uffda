import { tests } from "../../test.ts";
import { Meta } from "../meta.ts";
import { PatternKind } from "../../runtime/patterns/mod.ts";

tests(() => [
  {
    id: "THENPATTERN00",
    description: "a b",
    pattern: () => Meta,
    input: "x y",
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
