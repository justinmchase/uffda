import { DeclarationKind } from "../../../runtime/declarations/declaration.kind.ts";
import { IModuleDeclaration } from "../../../runtime/declarations/module.ts";
import { PatternKind } from "../../../runtime/patterns/mod.ts";
import { LangExpressionKind } from "../../lang/lang.pattern.ts";
import { AddExpression } from "../expressions/AddExpression.ts";
import { ArrayExpression } from "../expressions/ArrayExpression.ts";
import { InvocationExpression } from "../expressions/InvocationExpression.ts";
import { LambdaExpression } from "../expressions/LambdaExpression.ts";
import { NumberExpression } from "../expressions/NumberExpression.ts";
import { ReferenceExpression } from "../expressions/ReferenceExpression.ts";
import { SpecialReferenceExpression } from "../expressions/SpecialReferenceExpression.ts";
import { StringExpression } from "../expressions/StringExpression.ts";
import { SubtractExpression } from "../expressions/SubtractExpression.ts";

export const ExpressionPattern: IModuleDeclaration = {
  kind: DeclarationKind.Module,
  imports: [
    {
      kind: DeclarationKind.NativeImport,
      module: () => AddExpression,
      moduleUrl: "../expressions/AddExpression.ts",
      names: ["AddExpression"],
    },
    {
      kind: DeclarationKind.NativeImport,
      module: () => ArrayExpression,
      moduleUrl: "../expressions/ArrayExpression.ts",
      names: ["ArrayExpression"],
    },
    {
      kind: DeclarationKind.NativeImport,
      module: () => InvocationExpression,
      moduleUrl: "../expressions/InvocationExpression.ts",
      names: ["InvocationExpression"],
    },
    {
      kind: DeclarationKind.NativeImport,
      module: () => LambdaExpression,
      moduleUrl: "../expressions/LambdaExpression.ts",
      names: ["LambdaExpression"],
    },
    {
      kind: DeclarationKind.NativeImport,
      module: () => NumberExpression,
      moduleUrl: "../expressions/NumberExpression.ts",
      names: ["NumberExpression"],
    },
    {
      kind: DeclarationKind.NativeImport,
      module: () => ReferenceExpression,
      moduleUrl: "../expressions/ReferenceExpression.ts",
      names: ["ReferenceExpression"],
    },
    {
      kind: DeclarationKind.NativeImport,
      module: () => SpecialReferenceExpression,
      moduleUrl: "../expressions/SpecialReferenceExpression.ts",
      names: ["SpecialReferenceExpression"],
    },
    {
      kind: DeclarationKind.NativeImport,
      module: () => StringExpression,
      moduleUrl: "../expressions/StringExpression.ts",
      names: ["StringExpression"],
    },
    {
      kind: DeclarationKind.NativeImport,
      module: () => SubtractExpression,
      moduleUrl: "../expressions/SubtractExpression.ts",
      names: ["SubtractExpression"],
    },
  ],
  rules: [
    {
      kind: DeclarationKind.Rule,
      name: "ExpressionPattern",
      pattern: {
        kind: PatternKind.Or,
        patterns: [
          {
            kind: PatternKind.Reference,
            name: LangExpressionKind.AddExpression,
          },
          {
            kind: PatternKind.Reference,
            name: LangExpressionKind.ArrayExpression,
          },
          {
            kind: PatternKind.Reference,
            name: LangExpressionKind.InvocationExpression,
          },
          {
            kind: PatternKind.Reference,
            name: LangExpressionKind.LambdaExpression,
          },
          {
            kind: PatternKind.Reference,
            name: LangExpressionKind.NumberExpression,
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
            name: LangExpressionKind.StringExpression,
          },
          {
            kind: PatternKind.Reference,
            name: LangExpressionKind.SubtractExpression,
          },
        ],
      },
    },
  ],
};
