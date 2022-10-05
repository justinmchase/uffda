import { tests } from "../../../test.ts";
import { PatternKind } from "../../../runtime/patterns/mod.ts";
import { PatternCompiler } from "../PatternCompiler.ts";

tests(() => [
  {
    id: "ANYPATTERN00",
    description: "parses AnyPattern into any",
    pattern: () => PatternCompiler,
    input: "any",
    value: {
      kind: PatternKind.Any,
    },
  },
]);
