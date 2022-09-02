import { tests } from "../../test.ts";
import { Meta } from "../meta.ts";
import { PatternKind } from "../../runtime/patterns/mod.ts";

tests(() => [
  {
    id: "ONEORMOREPATTERN00",
    description: "a+",
    pattern: () => Meta,
    input: "a+",
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
