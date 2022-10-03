import { tests } from "../../../test.ts";
import { ExpressionKind } from "../../../runtime/expressions/mod.ts";
import { ExpressionCompiler } from "../ExpressionCompiler.ts";

const $0 = () => {};

tests(() => [
  {
    id: "SPECFUNCEXPR00",
    description: "$0",
    pattern: () => ExpressionCompiler,
    input: "$0",
    specials: { $0 },
    value: {
      kind: ExpressionKind.Native,
      fn: $0,
    },
  },
]);
