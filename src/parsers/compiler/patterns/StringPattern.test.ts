import { tests } from "../../../test.ts";
import { PatternKind } from "../../../runtime/patterns/mod.ts";
import { LangPatternKind } from "../../lang/lang.pattern.ts";
import { StringPattern } from "./StringPattern.ts";

tests(() => [
  {
    id: "STRINGPATTERN00",
    description: "'abc'",
    module: () => StringPattern,
    input: [
      { kind: LangPatternKind.StringPattern },
    ],
    value: {
      kind: PatternKind.String,
    },
  },
]);
