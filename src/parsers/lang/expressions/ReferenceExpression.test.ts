import { tests } from "../../../test.ts";
import { TokenizerKind } from "../../mod.ts";
import { LangExpressionKind } from "../lang.pattern.ts";
import { ReferenceExpression } from "./ReferenceExpression.ts";

tests(() => [
  {
    id: "REFEXP00",
    module: () => ReferenceExpression,
    input: [
      { kind: TokenizerKind.Identifier, value: "a" }
    ],
    value: {
      kind: LangExpressionKind.ReferenceExpression,
      name: "a",
    },
  },
]);
