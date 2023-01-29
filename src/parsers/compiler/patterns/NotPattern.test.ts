import { tests } from "../../../test.ts";
import { PatternKind } from "../../../runtime/patterns/mod.ts";
import { LangPatternKind } from "../../lang/lang.pattern.ts";
import { NotPattern } from "./NotPattern.ts";

tests(() => [
  {
    id: "NOT00",
    module: () => NotPattern,
    input: [
      {
        kind: LangPatternKind.NotPattern,
        pattern: {
          kind: LangPatternKind.EqualPattern,
          value: "abc",
        },
      }
    ],
    value: {
      kind: PatternKind.Not,
      pattern: {
        kind: PatternKind.Equal,
        value: "abc",
      }
    },
  },
]);
