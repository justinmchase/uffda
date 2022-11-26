import { tests } from "../../../test.ts";
import { ExpressionKind } from "../../../runtime/expressions/mod.ts";
import { SpecialReferenceExpression } from "./SpecialReferenceExpression.ts";
import { LangExpressionKind } from "../../lang/lang.pattern.ts";

const $0 = () => {};

tests(() => [
  {
    id: "SPECFUNCEXPR00",
    description: "$0",
    module: () => SpecialReferenceExpression,
    input: [
      { kind: LangExpressionKind.SpecialReferenceExpression, name: "$0" }
    ],
    specials: { $0 },
    value: {
      kind: ExpressionKind.Native,
      fn: $0,
    },
  },
]);
