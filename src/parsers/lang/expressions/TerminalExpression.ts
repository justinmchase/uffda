import { DeclarationKind } from "../../../runtime/declarations/declaration.kind.ts";
import { IModuleDeclaration } from "../../../runtime/declarations/module.ts";
import { PatternKind } from "../../../runtime/patterns/mod.ts";
import { LangExpressionKind } from "../lang.pattern.ts";
import { NumberExpression } from "./NumberExpression.ts";
import { StringExpression } from "./StringExpression.ts";
import { ReferenceExpression } from "./ReferenceExpression.ts";
import { SpecialReferenceExpression } from "./SpecialReferenceExpression.ts";
import { ObjectExpression } from "./ObjectExpression.ts";

export const TerminalExpression: IModuleDeclaration = {
  kind: DeclarationKind.Module,
  imports: [
    {
      kind: DeclarationKind.NativeImport,
      module: NumberExpression,
      moduleUrl: "./NumberExpression.ts",
      names: ["NumberExpression"],
    },
    {
      kind: DeclarationKind.NativeImport,
      module: StringExpression,
      moduleUrl: "./StringExpression.ts",
      names: ["StringExpression"],
    },
    {
      kind: DeclarationKind.NativeImport,
      module: ReferenceExpression,
      moduleUrl: "./ReferenceExpression.ts",
      names: ["ReferenceExpression"],
    },
    {
      kind: DeclarationKind.NativeImport,
      module: SpecialReferenceExpression,
      moduleUrl: "./SpecialReferenceExpression.ts",
      names: ["SpecialReferenceExpression"],
    },
    {
      kind: DeclarationKind.NativeImport,
      module: ObjectExpression,
      moduleUrl: "./ObjectExpression.ts",
      names: ["ObjectExpression"],
    },
  ],
  rules: [
    {
      kind: DeclarationKind.Rule,
      name: "TerminalExpression",
      pattern: {
        kind: PatternKind.Or,
        patterns: [
          {
            kind: PatternKind.Reference,
            name: LangExpressionKind.NumberExpression,
          },
          {
            kind: PatternKind.Reference,
            name: LangExpressionKind.StringExpression,
          },
          {
            kind: PatternKind.Reference,
            name: LangExpressionKind.ReferenceExpression,
          },
          {
            kind: PatternKind.Reference,
            name: LangExpressionKind.SpecialReferenceExpression,
          },
          {
            kind: PatternKind.Reference,
            name: LangExpressionKind.ObjectExpression,
          },
        ],
      },
    }
  ]
};
