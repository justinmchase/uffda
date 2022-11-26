import { PatternKind } from "../../../runtime/patterns/mod.ts";
import { ExpressionKind } from "../../../runtime/expressions/mod.ts";
import { LangPatternKind } from "../lang.pattern.ts";
import { DeclarationKind } from "../../../runtime/declarations/declaration.kind.ts";
import { IModuleDeclaration } from "../../../runtime/declarations/module.ts";
import { PatternPattern } from "./PatternPattern.ts";

export const GroupPattern: IModuleDeclaration = {
  kind: DeclarationKind.Module,
  imports: [
    {
      kind: DeclarationKind.NativeImport,
      module: () => PatternPattern,
      moduleUrl: "./PatternPattern.ts",
      names: ["PatternPattern"],
    }
  ],
  rules: [
    {
      kind: DeclarationKind.Rule,
      name: "GroupPattern",
      pattern: {
        kind: PatternKind.Projection,
        pattern: {
          kind: PatternKind.Then,
          patterns: [
            {
              kind: PatternKind.Object,
              keys: {
                kind: { kind: PatternKind.Equal, value: "Token" },
                value: { kind: PatternKind.Equal, value: "(" },
              },
            },
            {
              kind: PatternKind.Variable,
              name: "p",
              pattern: {
                kind: PatternKind.Reference,
                name: LangPatternKind.PatternPattern,
              },
            },
            {
              kind: PatternKind.Must,
              name: "TokenExpected",
              message: "Expected token `)`",
              pattern: {
                kind: PatternKind.Object,
                keys: {
                  kind: { kind: PatternKind.Equal, value: "Token" },
                  value: { kind: PatternKind.Equal, value: ")" },
                },
              },
            },
          ],
        },
        expression: {
          kind: ExpressionKind.Native,
          fn: ({ p }) => p,
        },
      },
    }
  ]
};
