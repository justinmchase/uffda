import { tests } from "../../test.ts";
import { Meta } from "../meta.ts";
import { PatternKind } from "../../runtime/patterns/mod.ts";

tests(import.meta.url, () => [
  {
    id: "EQUAL00",
    description: "'abc'",
    pattern: () => Meta,
    input: "'abc'",
    value: {
      kind: PatternKind.Equal,
      value: "abc",
    },
  },
]);
