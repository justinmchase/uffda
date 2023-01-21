import { PatternKind } from "../../../runtime/patterns/mod.ts";
import { LangExpressionKind } from "../lang.pattern.ts";
import { ExpressionKind } from "../../../runtime/expressions/mod.ts";
import { DeclarationKind } from "../../../runtime/declarations/declaration.kind.ts";
import { IModuleDeclaration } from "../../../runtime/declarations/module.ts";
import { TokenizerKind } from "../../mod.ts";
import { ExpressionLang } from "../ExpressionLang.ts";

// 1. `undefined` expression
// 2. filter, map functions
// 3. (^'a'*)* - does it prevent infinite expansion already?
// 4. Define Expression pattern to match Lang Expression ast
//
// import '../ExpressionLang.ts' (ExpressionLang);
//
// MaybeString = string | undefined;
//
// StringExpression = {
//   kind = 'string'
//   value:value = string -> {
//     kind: 'string
//     value
//   })
// };

export const StringExpression: IModuleDeclaration = {
  kind: DeclarationKind.Module,
  imports: [
    {
      kind: DeclarationKind.NativeImport,
      module: () => ExpressionLang,
      moduleUrl: '../ExpressionLang.ts',
      names: ["ExpressionLang"],
    }
  ],
  rules: [
    {
      kind: DeclarationKind.Rule,
      name: "StringExpression",
      pattern: {
        kind: PatternKind.Projection,
        pattern: {
          kind: PatternKind.Object,
          keys: {
            kind: { kind: PatternKind.Equal, value: TokenizerKind.String },
            value: {
              kind: PatternKind.Variable,
              name: "value",
              pattern: {
                kind: PatternKind.String
              }
            },
          },
        },
        expression: {
          kind: ExpressionKind.Native,
          fn: ({ value }) => ({
            kind: LangExpressionKind.StringExpression,
            value
          }),
        },
      },
    },
  ],
};
