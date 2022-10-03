import { tests } from "../../../test.ts";
import { PatternKind } from "../../../runtime/patterns/mod.ts";
import { ExpressionKind } from "../../../runtime/expressions/mod.ts";
import { PatternCompiler } from "../PatternCompiler.ts";

const $0 = () => {};
tests(() => [
  {
    id: "PROJECTIONPATTERN00",
    description: "a -> $0",
    pattern: () => PatternCompiler,
    input: "a -> $0",
    specials: { $0 },
    value: {
      kind: PatternKind.Projection,
      pattern: {
        kind: PatternKind.Reference,
        name: "a",
      },
      expression: {
        kind: ExpressionKind.Native,
        fn: $0,
      },
    },
  },
]);
