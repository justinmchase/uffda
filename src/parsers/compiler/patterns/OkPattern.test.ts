import { tests } from "../../../test.ts";
import { PatternKind } from "../../../runtime/patterns/mod.ts";
import { OkPattern } from "./OkPattern.ts";
import { LangPatternKind } from "../../lang/lang.pattern.ts";

tests(() => [
  {
    id: "OKPATTERN00",
    description: "parses OkPattern into ok",
    module: () => OkPattern,
    input: [
      { kind: LangPatternKind.OkPattern },
    ],
    value: { kind: PatternKind.Ok },
  },
]);
