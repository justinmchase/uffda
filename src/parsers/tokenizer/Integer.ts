import { PatternKind } from "../../runtime/patterns/mod.ts";
import { ExpressionKind } from "../../runtime/expressions/mod.ts";
import { Digit } from "./Digit.ts";
import { IModuleDeclaration } from "../../runtime/declarations/module.ts";
import { DeclarationKind } from "../../runtime/declarations/declaration.kind.ts";

export const Integer: IModuleDeclaration = {
  kind: DeclarationKind.Module,
  imports: [],
  rules: [
    {
      kind: DeclarationKind.Rule,
      name: "Integer",
      pattern: {
        kind: PatternKind.Projection,
        pattern: {
          kind: PatternKind.Slice,
          min: 1,
          pattern: Digit,
        },
        expression: {
          kind: ExpressionKind.Native,
          fn: ({ _ }) => _.join(""),
        },
      },
    },
  ],
};
