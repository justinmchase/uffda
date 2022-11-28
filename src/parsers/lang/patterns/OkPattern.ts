import { PatternKind } from "../../../runtime/patterns/mod.ts";
import { ExpressionKind } from "../../../runtime/expressions/mod.ts";
import { LangPatternKind } from "../lang.pattern.ts";
import { IModuleDeclaration } from "../../../runtime/declarations/module.ts";
import { DeclarationKind } from "../../../runtime/declarations/declaration.kind.ts";
import { TokenizerKind } from "../../mod.ts";

export const OkPattern: IModuleDeclaration = {
  kind: DeclarationKind.Module,
  imports: [],
  rules: [
    {
      kind: DeclarationKind.Rule,
      name: LangPatternKind.OkPattern,
      pattern: {
        kind: PatternKind.Projection,
        pattern: {
          kind: PatternKind.Object,
          keys: {
            kind: { kind: PatternKind.Equal, value: TokenizerKind.Identifier },
            value: { kind: PatternKind.Equal, value: PatternKind.Ok },
          },
        },
        expression: {
          kind: ExpressionKind.Native,
          fn: () => ({
            kind: LangPatternKind.OkPattern,
          }),
        },
      },
    },
  ],
};
