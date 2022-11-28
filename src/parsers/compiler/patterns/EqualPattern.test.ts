import { tests } from "../../../test.ts";
import { PatternKind } from "../../../runtime/patterns/mod.ts";
import { EqualPattern } from "./EqualPattern.ts";
import { LangPatternKind } from "../../lang/lang.pattern.ts";

tests(() => [
  {
    id: "EQUAL00",
    description: "'abc'",
    module: () => EqualPattern,
    input: [
      { kind: LangPatternKind.EqualPattern, value: "abc" },
    ],
    value: {
      kind: PatternKind.Equal,
      value: "abc",
    },
  },
  {
    id: "EQUAL01",
    description: "7",
    module: () => EqualPattern,
    input: [
      { kind: LangPatternKind.EqualPattern, value: 7 },
    ],
    value: {
      kind: PatternKind.Equal,
      value: 7,
    },
  },
]);
