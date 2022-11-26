import { tests } from "../../../test.ts";
import { TokenizerKind } from "../../mod.ts";
import { LangExpressionKind, LangPatternKind } from "../lang.pattern.ts";
import { NumberExpression } from "./NumberExpression.ts";

tests(() => [
  {
    id: "NUMBER00",
    module: () => NumberExpression,
    input: [
      { kind: TokenizerKind.Integer, value: 1 },
    ],
    value: { kind: LangExpressionKind.NumberExpression, value: 1 },
  },
  {
    future: true,
    id: "NUMBER01",
    module: () => NumberExpression,
    input: "A -> 1.1",
    value: {
      kind: LangPatternKind.ProjectionPattern,
      pattern: { kind: LangPatternKind.ReferencePattern, name: "A" },
      expression: { kind: LangExpressionKind.NumberExpression, value: 1 },
    },
  },
]);
