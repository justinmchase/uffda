import { tests } from "../../../test.ts";
import { PatternKind } from "../../../runtime/patterns/mod.ts";
import { LangPatternKind } from "../../lang/lang.pattern.ts";
import { AnyPattern } from "./AnyPattern.ts";

tests(() => [
  {
    id: "ANYPATTERN00",
    module: () => AnyPattern,
    // input: "any",
    input: [
      { kind: LangPatternKind.AnyPattern }
    ],
    value: {
      kind: PatternKind.Any,
    },
  },
]);
