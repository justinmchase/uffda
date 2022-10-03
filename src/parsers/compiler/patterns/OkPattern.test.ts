import { tests } from "../../../test.ts";
import { PatternKind } from "../../../runtime/patterns/mod.ts";
import { PatternCompiler } from "../PatternCompiler.ts";

tests(() => [
  {
    id: "OKPATTERN00",
    description: "parses OkPattern into ok",
    pattern: () => PatternCompiler,
    input: "ok",
    value: { kind: PatternKind.Ok },
  },
]);
