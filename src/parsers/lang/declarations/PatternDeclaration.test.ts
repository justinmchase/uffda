import { tests } from "../../../test.ts";
import { Lang } from "../Lang.ts";
import { LangExpressionKind, LangModuleKind, LangPatternKind } from "../lang.pattern.ts";
import { PatternDeclaration } from "./PatternDeclaration.ts";
import { TokenizerKind } from "../../mod.ts";

tests(() => [
  {
    id: "LANG.PATTERNDECLARATION00",
    description: "can parse pattern declaration",
    module: () => PatternDeclaration,
    input: [
      { kind: TokenizerKind.Identifier, value: "x" },
      { kind: TokenizerKind.Token, value: "=" },
      { kind: TokenizerKind.Identifier, value: "y" },
      { kind: TokenizerKind.Token, value: ";" },
    ],
    value: {
      kind: LangModuleKind.PatternDeclaration,
      name: "x",
      pattern: {
        kind: LangPatternKind.ReferencePattern,
        name: "y",
      },
    },
  },
]);

