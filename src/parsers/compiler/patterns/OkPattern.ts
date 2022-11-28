import { PatternKind } from "../../../runtime/patterns/mod.ts";
import { ExpressionKind } from "../../../runtime/expressions/mod.ts";
import { LangPatternKind } from "../../lang/lang.pattern.ts";
import { IModuleDeclaration } from "../../../runtime/declarations/module.ts";
import { DeclarationKind } from "../../../runtime/declarations/declaration.kind.ts";

export const OkPattern: IModuleDeclaration = {
  kind: DeclarationKind.Module,
  imports: [],
  rules: [
    {
      kind: DeclarationKind.Rule,
      name: "OkPattern",
      pattern: {
        kind: PatternKind.Projection,
        pattern: {
          kind: PatternKind.Object,
          keys: {
            kind: {
              kind: PatternKind.Equal,
              value: LangPatternKind.OkPattern,
            },
          },
        },
        expression: {
          kind: ExpressionKind.Native,
          fn: () => ({
            kind: PatternKind.Ok,
          }),
        },
      },
    },
  ],
};
