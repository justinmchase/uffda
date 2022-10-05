import { tests } from "../../../test.ts";
import { PatternKind } from "../../../runtime/patterns/mod.ts";
import { PatternCompiler } from "../PatternCompiler.ts";

tests(() => [
  {
    id: "STRINGPATTERN00",
    description: "'abc'",
    pattern: () => PatternCompiler,
    input: "'abc'",
    value: {
      kind: PatternKind.Equal,
      value: "abc",
    },
  },
]);
