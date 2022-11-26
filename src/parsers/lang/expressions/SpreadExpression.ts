import { PatternKind } from "../../../runtime/patterns/mod.ts";
import { LangPatternKind } from "../lang.pattern.ts";
import { ExpressionKind } from "../../../runtime/expressions/mod.ts";
import { IModuleDeclaration } from "../../../runtime/declarations/module.ts";
import { DeclarationKind } from "../../../runtime/declarations/declaration.kind.ts";
import { TokenizerKind } from "../../tokenizer/Tokenizer.ts";
import { ExpressionPattern } from "../patterns/ExpressionPattern.ts";

export const SpreadExpression: IModuleDeclaration = {
  kind: DeclarationKind.Module,
  imports: [
    {
      kind: DeclarationKind.NativeImport,
      module: () => ExpressionPattern,
      moduleUrl: "../patterns/ExpressionPattern.ts",
      names: ["ExpressionPattern"]
    }
  ],
  rules: [
    {
      kind: DeclarationKind.Rule,
      name: "SpreadExpression",
      pattern: {
        kind: PatternKind.Projection,
        pattern: {
          kind: PatternKind.Then,
          patterns: [
            {
              kind: PatternKind.Object,
              keys: {
                kind: { kind: PatternKind.Equal, value: TokenizerKind.Token },
                value: { kind: PatternKind.Equal, value: "." },
              },
            },
            {
              kind: PatternKind.Object,
              keys: {
                kind: { kind: PatternKind.Equal, value: TokenizerKind.Token },
                value: { kind: PatternKind.Equal, value: "." },
              },
            },
            {
              kind: PatternKind.Object,
              keys: {
                kind: { kind: PatternKind.Equal, value: TokenizerKind.Token },
                value: { kind: PatternKind.Equal, value: "." },
              },
            },
            {
              kind: PatternKind.Variable,
              name: "expression",
              pattern: {
                kind: PatternKind.Reference,
                name: LangPatternKind.ExpressionPattern,
              },
            },
          ],
        },
        expression: {
          kind: ExpressionKind.Native,
          fn: ({ expression }) => expression,
        },
      },
    }
  ]
};
