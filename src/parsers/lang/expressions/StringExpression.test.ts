import { tests } from "../../../test.ts";
import { TokenizerKind } from "../../mod.ts";
import { LangExpressionKind } from "../lang.pattern.ts";
import { StringExpression } from "./StringExpression.ts";

tests(() => [
  {
    id: "LANG.EXPRESSION.STRING00",
    module: () => StringExpression,
    input: [
      { kind: TokenizerKind.String, value: "" },
    ],
    value: { kind: LangExpressionKind.StringExpression, value: '' },
  },
  {
    id: "LANG.EXPRESSION.STRING01",
    module: () => StringExpression,
    input: [
      { kind: TokenizerKind.String, value: "abc" },
    ],
    value: { kind: LangExpressionKind.StringExpression, value: 'abc' },
  },
  {
    id: "LANG.EXPRESSION.STRING02",
    module: () => StringExpression,
    input: [
      { kind: TokenizerKind.String, value: "'\"" },
    ],
    value: { kind: LangExpressionKind.StringExpression, value: '\'"' },
  },
]);
