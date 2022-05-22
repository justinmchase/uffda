import { tests } from "../../test.ts";
import { Meta } from "../meta.ts";
import { PatternKind } from "../../runtime/patterns/mod.ts";

tests(import.meta.url, () => [
  {
    id: "ANYPATTERN00",
    description: "parses AnyPattern into any",
    pattern: () => Meta,
    input: "any",
    value: {
      kind: PatternKind.Any,
    },
  },
]);
