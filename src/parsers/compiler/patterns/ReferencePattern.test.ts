import { tests } from "../../../test.ts";
import { PatternKind } from "../../../runtime/patterns/mod.ts";
import { ReferencePattern } from "./ReferencePattern.ts";
import { LangPatternKind } from "../../lang/lang.pattern.ts";

tests(() => [
  {
    id: "REFERENCE00",
    description: "a",
    module: () => ReferencePattern,
    input: [
      { kind: LangPatternKind.ReferencePattern, name: "a" },
    ],
    value: {
      kind: PatternKind.Reference,
      name: "a",
    },
  },
]);
