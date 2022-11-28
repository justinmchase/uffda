import { tests } from "../../../test.ts";
import { TokenizerKind } from "../../mod.ts";
import { LangExpressionKind } from "../lang.pattern.ts";
import { SpecialReferenceExpression } from "./SpecialReferenceExpression.ts";

tests(() => [
  {
    id: "SPECREFEXP00",
    description: "Can parse special reference",
    module: () => SpecialReferenceExpression,
    input: [
      { kind: TokenizerKind.SpecialIdentifier, value: "$0" },
    ],
    value: {
      kind: LangExpressionKind.SpecialReferenceExpression,
      name: "$0",
    },
  },
]);
